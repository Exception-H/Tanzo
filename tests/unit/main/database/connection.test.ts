import { describe, expect, it, vi } from 'vitest'
import { TanzoConfigurationError } from '@shared/errors'
import { openDatabase } from '@main/database/connection'
import { runMigrations } from '@main/database/migrations'

const sqliteMock = vi.hoisted(() => {
  const rawInstances: FakeRawDatabase[] = []

  class FakeStatement {
    constructor(
      private readonly raw: FakeRawDatabase,
      private readonly sql: string
    ) {}

    run(...params: unknown[]) {
      if (this.sql.startsWith('INSERT INTO items')) {
        this.raw.items.push({ id: this.raw.items.length + 1, name: String(params[0]) })
      }
      if (this.sql.startsWith('INSERT INTO _tanzo_migrations')) {
        const [module, version, name] = params
        this.raw.migrations.push({ module, version, name })
      }
      return {}
    }

    get(...params: unknown[]) {
      if (this.sql.startsWith('SELECT name FROM items WHERE id = ?')) {
        return this.raw.items.find((item) => item.id === params[0])
      }
      return undefined
    }

    all(...params: unknown[]) {
      if (this.sql.startsWith('SELECT name FROM items')) {
        return this.raw.items.map(({ name }) => ({ name }))
      }
      if (this.sql.startsWith('SELECT version FROM _tanzo_migrations')) {
        return this.raw.migrations
          .filter((row) => row.module === params[0])
          .map(({ version }) => ({ version }))
      }
      if (this.sql.startsWith('SELECT version, name FROM _tanzo_migrations')) {
        return this.raw.migrations
          .filter((row) => row.module === params[0])
          .map(({ version, name }) => ({ version, name }))
      }
      return []
    }
  }

  class FakeRawDatabase {
    pragmas: string[] = []
    execSql: string[] = []
    items: Array<{ id: number; name: string }> = []
    migrations: Array<{ module: unknown; version: unknown; name: unknown }> = []
    closed = false

    constructor(readonly databasePath: string) {
      if (databasePath.includes('fail-open')) throw new Error('open failed')
      rawInstances.push(this)
    }

    pragma(directive: string) {
      this.pragmas.push(directive)
    }

    exec(sql: string) {
      this.execSql.push(sql)
    }

    prepare(sql: string) {
      return new FakeStatement(this, sql)
    }

    transaction<T>(fn: () => T) {
      return () => fn()
    }

    close() {
      this.closed = true
    }
  }

  return { FakeRawDatabase, rawInstances }
})

vi.mock('better-sqlite3', () => ({ default: sqliteMock.FakeRawDatabase }))

describe('main/database/connection and migrations', () => {
  it('opens a sqlite database and wraps statement helpers', () => {
    const opened = openDatabase({ databasePath: '/tmp/test.sqlite' })

    opened.db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
    opened.db.prepare('INSERT INTO items (name) VALUES (?)').run(['one'])

    expect(opened.db.prepare('SELECT name FROM items WHERE id = ?').get([1])).toEqual({
      id: 1,
      name: 'one'
    })
    expect(opened.db.prepare('SELECT name FROM items').all()).toEqual([{ name: 'one' }])
    expect(sqliteMock.rawInstances.at(-1)?.pragmas).toEqual(
      expect.arrayContaining(['journal_mode = WAL', 'foreign_keys = ON'])
    )

    opened.db.close()
    expect(sqliteMock.rawInstances.at(-1)?.closed).toBe(true)
  })

  it('runs migrations once and records applied versions', () => {
    const { db } = openDatabase({ databasePath: '/tmp/migrate.sqlite' })
    let applied = 0

    runMigrations(db, [
      {
        moduleName: 'unit',
        files: [
          {
            version: 1,
            name: 'create table',
            up(tx) {
              applied += 1
              tx.exec('CREATE TABLE migrated (id INTEGER)')
            }
          }
        ]
      }
    ])
    runMigrations(db, [
      {
        moduleName: 'unit',
        files: [{ version: 1, name: 'create table', up: () => void (applied += 1) }]
      }
    ])

    expect(applied).toBe(1)
    expect(
      db.prepare('SELECT version, name FROM _tanzo_migrations WHERE module = ?').all(['unit'])
    ).toEqual([{ version: 1, name: 'create table' }])
  })

  it('wraps open failures, unsorted migrations, and migration failures', () => {
    expect(() => openDatabase({ databasePath: '/tmp/fail-open.sqlite' })).toThrow(
      TanzoConfigurationError
    )
    const { db } = openDatabase({ databasePath: '/tmp/bad.sqlite' })

    expect(() =>
      runMigrations(db, [
        {
          moduleName: 'bad',
          files: [
            { version: 2, name: 'two', up: () => undefined },
            { version: 1, name: 'one', up: () => undefined }
          ]
        }
      ])
    ).toThrow(TanzoConfigurationError)
    expect(() =>
      runMigrations(db, [
        {
          moduleName: 'bad2',
          files: [
            {
              version: 1,
              name: 'boom',
              up: () => {
                throw new Error('boom')
              }
            }
          ]
        }
      ])
    ).toThrow('Migration bad2@1 (boom) failed.')
  })
})
