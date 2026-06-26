import Database, { type Database as BetterSqliteDatabase } from 'better-sqlite3'
import { TanzoConfigurationError } from '@shared/errors'
import type { SqlDatabase } from './types'

const PRAGMAS = [
  'journal_mode = WAL',
  'synchronous = NORMAL',
  'foreign_keys = ON',
  'busy_timeout = 5000',
  'temp_store = MEMORY'
] as const

export interface OpenDatabaseOptions {
  databasePath: string
}

export interface OpenedDatabase {
  db: SqlDatabase
  raw: BetterSqliteDatabase
}

export function openDatabase({ databasePath }: OpenDatabaseOptions): OpenedDatabase {
  let raw: BetterSqliteDatabase
  try {
    raw = new Database(databasePath)
  } catch (error) {
    throw new TanzoConfigurationError(
      'DATABASE_OPEN_FAILED',
      `Failed to open database at ${databasePath}.`,
      { cause: error, details: { databasePath } }
    )
  }

  for (const directive of PRAGMAS) raw.pragma(directive)

  return { db: wrap(raw), raw }
}

function wrap(raw: BetterSqliteDatabase): SqlDatabase {
  return {
    exec: (sql) => raw.exec(sql),
    prepare: (sql) => {
      const stmt = raw.prepare(sql)
      return {
        run: (params) =>
          params === undefined
            ? stmt.run()
            : Array.isArray(params)
              ? stmt.run(...params)
              : stmt.run(params),
        get: (params) =>
          params === undefined
            ? stmt.get()
            : Array.isArray(params)
              ? stmt.get(...params)
              : stmt.get(params),
        all: (params) =>
          params === undefined
            ? stmt.all()
            : Array.isArray(params)
              ? stmt.all(...params)
              : stmt.all(params)
      }
    },
    transaction: (fn) => raw.transaction(fn)(),
    pragma: (directive) => {
      raw.pragma(directive)
    },
    close: () => raw.close()
  }
}
