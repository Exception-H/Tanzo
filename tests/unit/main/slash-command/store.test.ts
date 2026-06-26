import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSlashCommandStore } from '@main/slash-command/store'

const roots: string[] = []

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'tanzo-slash-store-'))
  roots.push(root)
  return root
}

function logger() {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('main/slash-command/store', () => {
  it('loads markdown commands from user and workspace roots with frontmatter metadata', () => {
    const root = tempRoot()
    const workspaceRoot = join(root, 'workspace')
    const userDir = join(root, 'user')
    const userCommands = join(userDir, 'commands')
    const workspaceCommands = join(workspaceRoot, '.tanzo', 'commands')
    const userName = `user-review-${Date.now()}`
    const workspaceName = `workspace-review-${Date.now()}`

    mkdirSync(userCommands, { recursive: true })
    mkdirSync(workspaceCommands, { recursive: true })
    writeFileSync(join(userCommands, `${userName}.md`), 'User review $ARGUMENTS')
    writeFileSync(
      join(workspaceCommands, `${workspaceName}.md`),
      [
        '---',
        'description: Review a target',
        'argument-hint: <path>',
        '---',
        'Workspace review $1'
      ].join('\n')
    )

    const store = createSlashCommandStore({ userDir, logger: logger() as never })
    const commands = store.list(workspaceRoot)

    expect(commands.find((command) => command.name === userName)).toMatchObject({
      name: userName,
      kind: 'prompt',
      source: 'command',
      template: 'User review $ARGUMENTS'
    })
    expect(commands.find((command) => command.name === workspaceName)).toMatchObject({
      name: workspaceName,
      description: 'Review a target',
      argsHint: '<path>',
      template: 'Workspace review $1'
    })
  })

  it('lets workspace commands override user commands with the same filename', () => {
    const root = tempRoot()
    const workspaceRoot = join(root, 'workspace')
    const userDir = join(root, 'user')
    const userCommands = join(userDir, 'commands')
    const workspaceCommands = join(workspaceRoot, '.tanzo', 'commands')
    const name = `override-review-${Date.now()}`

    mkdirSync(userCommands, { recursive: true })
    mkdirSync(workspaceCommands, { recursive: true })
    writeFileSync(join(userCommands, `${name}.md`), 'User template')
    writeFileSync(join(workspaceCommands, `${name}.md`), 'Workspace template')

    const store = createSlashCommandStore({ userDir, logger: logger() as never })
    const command = store.list(workspaceRoot).find((candidate) => candidate.name === name)

    expect(command?.template).toBe('Workspace template')
  })

  it('skips empty command files and logs a warning', () => {
    const root = tempRoot()
    const workspaceRoot = join(root, 'workspace')
    const userDir = join(root, 'user')
    const workspaceCommands = join(workspaceRoot, '.tanzo', 'commands')
    const name = `empty-review-${Date.now()}`
    const log = logger()

    mkdirSync(workspaceCommands, { recursive: true })
    writeFileSync(join(workspaceCommands, `${name}.md`), '---\ndescription: Empty\n---\n')

    const store = createSlashCommandStore({ userDir, logger: log as never })

    expect(store.list(workspaceRoot).some((command) => command.name === name)).toBe(false)
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('has an empty body; skipped'))
  })
})
