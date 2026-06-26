import { mkdir, mkdtemp, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SqlDatabase } from '@main/database/types'
import { createSkillsStore } from '@main/agent/skills/store'

let roots: string[] = []

interface StateRow {
  name: string
  enabled: number
  installed: number
  scope: string | null
  install_path: string | null
  source_path: string | null
  installed_at: number | null
}

function createFakeDb(): SqlDatabase {
  const rows = new Map<string, StateRow>()
  const param = (params: unknown, key: string): unknown =>
    Array.isArray(params) ? params[0] : (params as Record<string, unknown>)[key]

  return {
    exec: vi.fn(),
    pragma: vi.fn(),
    close: vi.fn(),
    transaction: (fn) => fn(),
    prepare(sql: string) {
      return {
        all() {
          if (sql.startsWith('SELECT * FROM skill_states')) return [...rows.values()]
          return []
        },
        get(params?: unknown) {
          if (sql.startsWith('SELECT * FROM skill_states WHERE name')) {
            return rows.get(String(param(params, 'name'))) ?? undefined
          }
          return undefined
        },
        run(params?: unknown) {
          const values = params as Record<string, unknown>
          if (sql.startsWith('DELETE FROM skill_states')) {
            rows.delete(String(param(params, 'name')))
            return
          }
          const name = String(values.name)
          const existing = rows.get(name)
          if (sql.includes('installed, updated_at')) {
            rows.set(name, {
              name,
              enabled: Number(values.enabled),
              installed: existing?.installed ?? 0,
              scope: existing?.scope ?? null,
              install_path: existing?.install_path ?? null,
              source_path: existing?.source_path ?? null,
              installed_at: existing?.installed_at ?? null
            })
            return
          }

          rows.set(name, {
            name,
            enabled: Number(values.enabled),
            installed: 1,
            scope: (values.scope as string) ?? null,
            install_path: (values.install_path as string) ?? null,
            source_path: (values.source_path as string) ?? null,
            installed_at: (values.installed_at as number) ?? null
          })
        }
      }
    }
  }
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'tanzo-skill-states-'))
  roots.push(root)
  return root
}

async function writeSkill(dir: string, name: string, description: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\nBody for ${name}\n`
  )
}

function makeStore(workspaceRoot: string, userDir: string) {
  const logger = { warn: vi.fn() }
  return createSkillsStore({ workspaceRoot, userDir, logger: logger as never, db: createFakeDb() })
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  roots = []
})

describe('main/agent/skills/store state', () => {
  it('treats scanned skills as enabled by default and reflects scope', async () => {
    const workspaceRoot = await tempRoot()
    const userDir = await tempRoot()
    await writeSkill(join(userDir, 'skills', 'alpha'), 'alpha', 'Alpha skill')
    await writeSkill(join(workspaceRoot, '.claude', 'skills', 'beta'), 'beta', 'Beta skill')

    const store = makeStore(workspaceRoot, userDir)
    const snapshot = store.snapshot()

    expect(snapshot.skills.find((s) => s.name === 'alpha')).toMatchObject({
      enabled: true,
      installed: false,
      scope: 'user'
    })
    expect(snapshot.skills.find((s) => s.name === 'beta')).toMatchObject({
      enabled: true,
      installed: false,
      scope: 'workspace'
    })
    expect(store.listEnabled().map((s) => s.name)).toEqual(
      expect.arrayContaining(['alpha', 'beta'])
    )
  })

  it('disabling a skill removes it from listEnabled but keeps it in list', async () => {
    const workspaceRoot = await tempRoot()
    const userDir = await tempRoot()
    await writeSkill(join(userDir, 'skills', 'alpha'), 'alpha', 'Alpha skill')

    const store = makeStore(workspaceRoot, userDir)
    store.setEnabled('alpha', false)

    expect(store.listEnabled().map((s) => s.name)).not.toContain('alpha')
    expect(store.list().map((s) => s.name)).toContain('alpha')
    expect(store.snapshot().skills.find((s) => s.name === 'alpha')).toMatchObject({
      name: 'alpha',
      enabled: false
    })
  })

  it('installs a local skill directory into the user scope and records it', async () => {
    const workspaceRoot = await tempRoot()
    const userDir = await tempRoot()
    const source = await tempRoot()
    await writeSkill(source, 'packaged', 'Packaged skill')

    const store = makeStore(workspaceRoot, userDir)
    const snapshot = store.install({ sourcePath: source, scope: 'user', enableAfterInstall: true })

    expect(snapshot.skills.find((s) => s.name === 'packaged')).toMatchObject({
      enabled: true,
      installed: true,
      scope: 'user'
    })
    const copied = await stat(join(userDir, 'skills', 'packaged', 'SKILL.md'))
    expect(copied.isFile()).toBe(true)
  })

  it('rejects install when the source has no SKILL.md', async () => {
    const workspaceRoot = await tempRoot()
    const userDir = await tempRoot()
    const source = await tempRoot()

    const store = makeStore(workspaceRoot, userDir)
    expect(() => store.install({ sourcePath: source, scope: 'user' })).toThrow(/SKILL\.md/)
  })

  it('rejects install on conflict unless replace is set', async () => {
    const workspaceRoot = await tempRoot()
    const userDir = await tempRoot()
    const source = await tempRoot()
    await writeSkill(source, 'dupe', 'Dupe skill')

    const store = makeStore(workspaceRoot, userDir)
    store.install({ sourcePath: source, scope: 'user' })
    expect(() => store.install({ sourcePath: source, scope: 'user' })).toThrow(/already exists/)
    expect(() => store.install({ sourcePath: source, scope: 'user', replace: true })).not.toThrow()
  })

  it('uninstalls an installed skill, removing files and state', async () => {
    const workspaceRoot = await tempRoot()
    const userDir = await tempRoot()
    const source = await tempRoot()
    await writeSkill(source, 'removable', 'Removable skill')

    const store = makeStore(workspaceRoot, userDir)
    store.install({ sourcePath: source, scope: 'user' })
    const snapshot = store.uninstall('removable')

    expect(snapshot.skills.find((s) => s.name === 'removable')).toBeUndefined()
    await expect(stat(join(userDir, 'skills', 'removable'))).rejects.toThrow()
  })

  it('refuses to uninstall a skill that was only scanned', async () => {
    const workspaceRoot = await tempRoot()
    const userDir = await tempRoot()
    await writeSkill(join(userDir, 'skills', 'scanned'), 'scanned', 'Scanned skill')

    const store = makeStore(workspaceRoot, userDir)
    expect(() => store.uninstall('scanned')).toThrow(/not installed/)
  })
})
