import type { SqlDatabase } from '../../database/types'
import type { SkillInstallScope } from '@shared/skills'

export interface SkillStateRecord {
  name: string
  enabled: boolean
  installed: boolean
  scope: SkillInstallScope | null
  installPath: string | null
  sourcePath: string | null
  installedAt: number | null
}

export interface RecordInstallInput {
  name: string
  enabled: boolean
  scope: SkillInstallScope
  installPath: string
  sourcePath: string | null
  installedAt: number
}

export interface SkillStateStore {
  all(): Map<string, SkillStateRecord>
  get(name: string): SkillStateRecord | undefined
  setEnabled(name: string, enabled: boolean): void
  recordInstall(input: RecordInstallInput): void
  remove(name: string): void
}

interface SkillStateRow {
  name: string
  enabled: number
  installed: number
  scope: string | null
  install_path: string | null
  source_path: string | null
  installed_at: number | null
}

function rowToRecord(row: SkillStateRow): SkillStateRecord {
  return {
    name: row.name,
    enabled: row.enabled !== 0,
    installed: row.installed !== 0,
    scope: row.scope === 'user' || row.scope === 'workspace' ? row.scope : null,
    installPath: row.install_path,
    sourcePath: row.source_path,
    installedAt: row.installed_at
  }
}

export function createSkillStateStore(db: SqlDatabase): SkillStateStore {
  const selectAll = db.prepare('SELECT * FROM skill_states')
  const selectOne = db.prepare('SELECT * FROM skill_states WHERE name = ?')
  const deleteOne = db.prepare('DELETE FROM skill_states WHERE name = ?')
  const upsertEnabled = db.prepare(`INSERT INTO skill_states
    (name, enabled, installed, updated_at)
    VALUES (@name, @enabled, 0, @updated_at)
    ON CONFLICT(name) DO UPDATE SET enabled = @enabled, updated_at = @updated_at`)
  const upsertInstall = db.prepare(`INSERT INTO skill_states
    (name, enabled, installed, scope, install_path, source_path, installed_at, updated_at)
    VALUES (@name, @enabled, 1, @scope, @install_path, @source_path, @installed_at, @updated_at)
    ON CONFLICT(name) DO UPDATE SET
      enabled = @enabled, installed = 1, scope = @scope, install_path = @install_path,
      source_path = @source_path, installed_at = @installed_at, updated_at = @updated_at`)

  return {
    all() {
      const map = new Map<string, SkillStateRecord>()
      for (const row of selectAll.all() as SkillStateRow[]) {
        map.set(row.name, rowToRecord(row))
      }
      return map
    },
    get(name) {
      const row = selectOne.get([name]) as SkillStateRow | undefined
      return row ? rowToRecord(row) : undefined
    },
    setEnabled(name, enabled) {
      upsertEnabled.run({ name, enabled: enabled ? 1 : 0, updated_at: Date.now() })
    },
    recordInstall(input) {
      upsertInstall.run({
        name: input.name,
        enabled: input.enabled ? 1 : 0,
        scope: input.scope,
        install_path: input.installPath,
        source_path: input.sourcePath,
        installed_at: input.installedAt,
        updated_at: Date.now()
      })
    },
    remove(name) {
      deleteOne.run([name])
    }
  }
}
