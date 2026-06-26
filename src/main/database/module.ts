import path from 'node:path'
import { TanzoConfigurationError } from '@shared/errors'
import { createLogger } from '../logger'
import { openDatabase } from './connection'
import { runMigrations } from './migrations'
import type { ModuleMigrations, SqlDatabase } from './types'

const log = createLogger('database')

const DEFAULT_FILE_NAME = 'tanzo.sqlite'

export interface CreateDatabaseModuleOptions {
  userDataPath: string
  databaseFileName?: string
  migrations: readonly ModuleMigrations[]
}

export interface DatabaseModule {
  db: SqlDatabase
  backupTo(destinationPath: string): Promise<void>
  close(): void
}

export function createDatabaseModule(options: CreateDatabaseModuleOptions): DatabaseModule {
  const databasePath = path.join(
    options.userDataPath,
    options.databaseFileName ?? DEFAULT_FILE_NAME
  )
  const opened = openDatabase({ databasePath })
  const { db, raw } = opened

  runMigrations(db, options.migrations)

  log.info('initialized', {
    databasePath,
    modules: options.migrations.map((m) => m.moduleName)
  })

  return {
    db,
    async backupTo(destinationPath) {
      try {
        await raw.backup(destinationPath)
      } catch (error) {
        throw new TanzoConfigurationError(
          'DATABASE_BACKUP_FAILED',
          `Failed to back up database to ${destinationPath}.`,
          { cause: error, details: { destinationPath } }
        )
      }
    },
    close() {
      try {
        raw.pragma('wal_checkpoint(TRUNCATE)')
      } catch (error) {
        log.warn('wal checkpoint on close failed', { error })
      }
      db.close()
      log.info('closed')
    }
  }
}

export type { ModuleMigrations, Migration, SqlDatabase, SqlStatement } from './types'

export { runMigrations } from './migrations'

export { openDatabase } from './connection'
