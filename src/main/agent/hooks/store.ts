import { z } from 'zod'
import type { SqlDatabase } from '../../database/types'
import type { HookState } from './types'

const STATE_KEY_PREFIX = 'hooks.state:'

const stateSchema = z.object({
  enabled: z.boolean(),
  trustedHash: z.string().optional()
})

export interface HooksStore {
  getState(hookKey: string, workspaceId?: string): HookState | undefined
  setState(hookKey: string, state: HookState, workspaceId?: string): void
  listStates(workspaceId?: string): Map<string, HookState>
}

interface SettingRow {
  key: string
  value_json: string
}

function scopeFor(workspaceId?: string): { scope: 'app' | 'workspace'; scopeId: string | null } {
  return workspaceId
    ? { scope: 'workspace', scopeId: workspaceId }
    : { scope: 'app', scopeId: null }
}

export function createHooksStore(db: SqlDatabase): HooksStore {
  const selectOne = db.prepare(
    'SELECT key, value_json FROM app_settings WHERE scope = @scope AND scope_id IS @scope_id AND key = @key'
  )
  const selectAll = db.prepare(
    `SELECT key, value_json FROM app_settings
       WHERE scope = @scope AND scope_id IS @scope_id AND key LIKE @prefix`
  )
  const insert = db.prepare(`INSERT INTO app_settings (scope, scope_id, key, value_json, updated_at)
    VALUES (@scope, @scope_id, @key, @value_json, @updated_at)`)
  const deleteAppSetting = db.prepare(
    'DELETE FROM app_settings WHERE scope = @scope AND scope_id IS @scope_id AND key = @key'
  )
  const upsert = db.prepare(`INSERT INTO app_settings (scope, scope_id, key, value_json, updated_at)
    VALUES (@scope, @scope_id, @key, @value_json, @updated_at)
    ON CONFLICT(scope, scope_id, key) DO UPDATE SET
      value_json = @value_json, updated_at = @updated_at`)

  function parse(row: SettingRow | undefined): HookState | undefined {
    if (!row) return undefined
    try {
      const parsed = stateSchema.safeParse(JSON.parse(row.value_json))
      return parsed.success ? parsed.data : undefined
    } catch {
      return undefined
    }
  }

  return {
    getState(hookKey, workspaceId) {
      const { scope, scopeId } = scopeFor(workspaceId)
      const row = selectOne.get({ scope, scope_id: scopeId, key: `${STATE_KEY_PREFIX}${hookKey}` })
      return parse(row as SettingRow | undefined)
    },
    setState(hookKey, state, workspaceId) {
      const { scope, scopeId } = scopeFor(workspaceId)
      const params = {
        scope,
        scope_id: scopeId,
        key: `${STATE_KEY_PREFIX}${hookKey}`,
        value_json: JSON.stringify(state),
        updated_at: Date.now()
      }
      if (scopeId === null) {
        db.transaction(() => {
          deleteAppSetting.run(params)
          insert.run(params)
        })
        return
      }
      upsert.run(params)
    },
    listStates(workspaceId) {
      const { scope, scopeId } = scopeFor(workspaceId)
      const rows = selectAll.all({
        scope,
        scope_id: scopeId,
        prefix: `${STATE_KEY_PREFIX}%`
      }) as SettingRow[]
      const out = new Map<string, HookState>()
      for (const row of rows) {
        const state = parse(row)
        if (state) out.set(row.key.slice(STATE_KEY_PREFIX.length), state)
      }
      return out
    }
  }
}
