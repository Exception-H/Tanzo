import { describe, expect, it } from 'vitest'
import { TanzoValidationError } from '@shared/errors'
import type { SqlDatabase } from '@main/database/types'
import { createMcpStore } from '@main/mcp/store'

interface ServerRow {
  id: string
  name: string
  description: string | null
  transport: string
  command: string | null
  args_json: string | null
  cwd: string | null
  url: string | null
  headers_json: string | null
  redirect: string | null
  env_json: string | null
  enabled: number
  created_at: number
  updated_at: number
}

function createDb(): SqlDatabase & { rows: ServerRow[] } {
  const rows: ServerRow[] = []
  let nextId = 1

  function duplicateName(name: string, id?: string): boolean {
    return rows.some((row) => row.name === name && row.id !== id)
  }

  return {
    rows,
    exec: () => undefined,
    pragma: () => undefined,
    transaction: (fn) => fn(),
    close: () => undefined,
    prepare(sql) {
      return {
        run(params?: unknown) {
          if (sql.includes('INSERT INTO mcp_servers')) {
            const input = params as Record<string, unknown>
            if (duplicateName(String(input.name))) {
              throw new Error('UNIQUE constraint failed: mcp_servers.name')
            }
            rows.push({
              id: typeof input.id === 'string' ? input.id : `server-${nextId++}`,
              name: String(input.name),
              description: input.description as string | null,
              transport: String(input.transport),
              command: input.command as string | null,
              args_json: input.args_json as string | null,
              cwd: input.cwd as string | null,
              url: input.url as string | null,
              headers_json: input.headers_json as string | null,
              redirect: input.redirect as string | null,
              env_json: input.env_json as string | null,
              enabled: Number(input.enabled),
              created_at: Number(input.created_at),
              updated_at: Number(input.updated_at)
            })
          }
          if (sql.includes('UPDATE mcp_servers SET')) {
            const input = params as Record<string, unknown>
            const id = String(input.id)
            if (duplicateName(String(input.name), id)) {
              throw new Error('UNIQUE constraint failed: mcp_servers.name')
            }
            const index = rows.findIndex((row) => row.id === id)
            if (index >= 0) {
              rows[index] = {
                id,
                name: String(input.name),
                description: input.description as string | null,
                transport: String(input.transport),
                command: input.command as string | null,
                args_json: input.args_json as string | null,
                cwd: input.cwd as string | null,
                url: input.url as string | null,
                headers_json: input.headers_json as string | null,
                redirect: input.redirect as string | null,
                env_json: input.env_json as string | null,
                enabled: Number(input.enabled),
                created_at: Number(input.created_at),
                updated_at: Number(input.updated_at)
              }
            }
          }
          if (sql.startsWith('DELETE FROM mcp_servers')) {
            const [id] = params as [string]
            const index = rows.findIndex((row) => row.id === id)
            if (index >= 0) rows.splice(index, 1)
          }
        },
        get(params?: unknown) {
          if (sql.includes('WHERE id = ?')) {
            const [id] = params as [string]
            return rows.find((row) => row.id === id)
          }
          if (sql.includes('WHERE name = ?')) {
            const [name] = params as [string]
            return rows.find((row) => row.name === name)
          }
          return undefined
        },
        all() {
          if (sql.includes('SELECT * FROM mcp_servers ORDER BY id')) {
            return [...rows].sort((a, b) => a.id.localeCompare(b.id))
          }
          return []
        }
      }
    }
  }
}

describe('main/mcp/store', () => {
  it('creates, lists, clones, updates, toggles, and deletes MCP servers', () => {
    const db = createDb()
    const store = createMcpStore(db)

    const created = store.create({
      name: ' filesystem ',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { ROOT: '/tmp' },
      enabled: true
    })
    expect(created).toMatchObject({
      id: expect.any(String),
      name: 'filesystem',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { ROOT: '/tmp' },
      enabled: true
    })

    created.args?.push('mutated')
    expect(store.getAll()[0].args).toEqual(['server.js'])

    expect(
      store.update(created.id!, {
        name: 'remote',
        transport: 'http',
        command: undefined,
        url: 'https://mcp.test',
        headers: { Authorization: 'token' }
      })
    ).toMatchObject({
      id: created.id,
      name: 'remote',
      transport: 'http',
      url: 'https://mcp.test',
      headers: { Authorization: 'token' }
    })
    expect(store.toggle(created.id!, false)?.enabled).toBe(false)
    expect(store.delete(created.id!)).toBe(true)
    expect(store.delete(created.id!)).toBe(false)
    expect(store.update(created.id!, { enabled: true })).toBeUndefined()
  })

  it('validates required fields and translates duplicate-name failures', () => {
    const store = createMcpStore(createDb())

    expect(() =>
      store.create({ name: ' ', transport: 'stdio', command: 'node', enabled: true })
    ).toThrow(TanzoValidationError)
    expect(() => store.create({ name: 'local', transport: 'stdio', enabled: true })).toThrow(
      'missing a command'
    )
    expect(() => store.create({ name: 'remote', transport: 'http', enabled: true })).toThrow(
      'missing a URL'
    )

    store.create({ name: 'one', transport: 'stdio', command: 'node', enabled: true })
    expect(() =>
      store.create({ name: 'one', transport: 'stdio', command: 'node', enabled: true })
    ).toThrow('already used')
  })
})
