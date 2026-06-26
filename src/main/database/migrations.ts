import { TanzoConfigurationError } from '@shared/errors'
import { createLogger } from '../logger'
import type { Migration, ModuleMigrations, SqlDatabase } from './types'

const log = createLogger('database.migration')

const REGISTRY_DDL = `
CREATE TABLE IF NOT EXISTS _tanzo_migrations (
  module TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (module, version)
)
`

interface AppliedRow {
  version: number
}

export function runMigrations(db: SqlDatabase, modules: readonly ModuleMigrations[]): void {
  db.exec(REGISTRY_DDL)
  const selectApplied = db.prepare('SELECT version FROM _tanzo_migrations WHERE module = ?')
  const insertApplied = db.prepare(
    'INSERT INTO _tanzo_migrations (module, version, name, applied_at) VALUES (?, ?, ?, ?)'
  )

  for (const module of modules) {
    assertSortedAndUnique(module)
    const applied = new Set(
      (selectApplied.all([module.moduleName]) as AppliedRow[]).map((row) => row.version)
    )
    for (const file of module.files) {
      if (applied.has(file.version)) continue
      apply(db, module.moduleName, file, insertApplied)
    }
  }
}

function apply(
  db: SqlDatabase,
  moduleName: string,
  file: Migration,
  insertApplied: ReturnType<SqlDatabase['prepare']>
): void {
  const startedAt = Date.now()
  try {
    db.transaction(() => {
      file.up(db)
      insertApplied.run([moduleName, file.version, file.name, Date.now()])
    })
  } catch (error) {
    throw new TanzoConfigurationError(
      'DATABASE_MIGRATION_FAILED',
      `Migration ${moduleName}@${file.version} (${file.name}) failed.`,
      { cause: error, details: { moduleName, version: file.version, name: file.name } }
    )
  }
  log.info('migration applied', {
    moduleName,
    version: file.version,
    name: file.name,
    durationMs: Date.now() - startedAt
  })
}

function assertSortedAndUnique(module: ModuleMigrations): void {
  const versions = module.files.map((f) => f.version)
  for (let i = 1; i < versions.length; i++) {
    if (versions[i] <= versions[i - 1]) {
      throw new TanzoConfigurationError(
        'DATABASE_MIGRATION_FAILED',
        `Migrations for module "${module.moduleName}" must be strictly increasing.`,
        { details: { moduleName: module.moduleName, versions } }
      )
    }
  }
}
