import { DatabaseSync } from 'node:sqlite'
import type { SqlDatabase } from '@main/database/types'
import { runMigrations } from '@main/database/migrations'
import { tanzoMigrations } from '@main/database/schema'

export interface RealDb extends SqlDatabase {
  raw: DatabaseSync
}

export function createRealDb(options: { migrate?: boolean } = {}): RealDb {
  const raw = new DatabaseSync(':memory:')
  raw.exec('PRAGMA foreign_keys = ON')
  let depth = 0

  const bind = (params?: Record<string, unknown> | unknown[]): unknown[] =>
    params === undefined ? [] : Array.isArray(params) ? params : [params]

  const db: RealDb = {
    raw,
    exec: (sql) => raw.exec(sql),
    prepare: (sql) => {
      const stmt = raw.prepare(sql)
      return {
        run: (params) => stmt.run(...(bind(params) as never[])),
        get: (params) => stmt.get(...(bind(params) as never[])),
        all: (params) => stmt.all(...(bind(params) as never[]))
      }
    },
    transaction: (fn) => {
      const savepoint = depth > 0 ? `sp_${depth}` : null
      raw.exec(savepoint ? `SAVEPOINT ${savepoint}` : 'BEGIN')
      depth += 1
      try {
        const result = fn()
        depth -= 1
        raw.exec(savepoint ? `RELEASE ${savepoint}` : 'COMMIT')
        return result
      } catch (error) {
        depth -= 1
        if (savepoint) {
          raw.exec(`ROLLBACK TO ${savepoint}`)
          raw.exec(`RELEASE ${savepoint}`)
        } else {
          raw.exec('ROLLBACK')
        }
        throw error
      }
    },
    pragma: () => {},
    close: () => raw.close()
  }

  if (options.migrate !== false) runMigrations(db, [tanzoMigrations])
  return db
}

export function countRows(
  db: RealDb,
  table: string,
  where = '1=1',
  params: unknown[] = []
): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).get(params) as {
    c: number
  }
  return row.c
}
