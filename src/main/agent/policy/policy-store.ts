import { z } from 'zod'
import type { PolicyMatch, PolicyRule, PolicyUserDecision } from '@shared/policy'
import { TanzoValidationError } from '@shared/errors'
import type { PolicyStore } from './types'
import type { SqlDatabase } from '../../database/types'

const policyMatchSchema = z.object({
  toolName: z.string().optional(),
  toolNameGlob: z.string().optional(),
  argMatch: z
    .object({
      path: z.string(),
      equals: z.string().optional(),
      regex: z.string().optional()
    })
    .optional()
})
const policyActionSchema = z.enum(['allow', 'deny', 'ask'])
const policyScopeSchema = z.enum(['system', 'project', 'user'])
const policyDecisionSchema = z.enum(['approved', 'denied'])
const permissionModeSchema = z.enum(['default', 'plan', 'yolo', 'dangerous'])

interface PolicyRuleRow {
  id: string
  match_json: string
  action: string
  reason: string | null
  scope: string
  priority: number
  created_at: number
  updated_at: number
}

interface PolicyDecisionRow {
  tool_name: string
  fingerprint: string
  decision: string
  scope_target_id: string
  decided_at: number
  expires_at: number | null
}

function parseMatch(value: string): PolicyMatch | undefined {
  try {
    const parsed = policyMatchSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

function rowToRule(row: PolicyRuleRow): PolicyRule | undefined {
  const match = parseMatch(row.match_json)
  const action = policyActionSchema.safeParse(row.action)
  const scope = policyScopeSchema.safeParse(row.scope)
  if (!match || !action.success || !scope.success) return undefined
  return {
    id: row.id,
    match,
    action: action.data,
    ...(row.reason ? { reason: row.reason } : {}),
    source: 'user',
    scope: scope.data,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToDecision(row: PolicyDecisionRow): PolicyUserDecision | undefined {
  const decision = policyDecisionSchema.safeParse(row.decision)
  if (!decision.success) return undefined
  return {
    toolName: row.tool_name,
    inputFingerprint: row.fingerprint,
    decision: decision.data,
    scope: 'forever',
    decidedAt: row.decided_at,
    ...(row.scope_target_id ? { scopeTargetId: row.scope_target_id } : {}),
    ...(row.expires_at !== null ? { expiresAt: row.expires_at } : {})
  }
}

export function createPolicyStore(db: SqlDatabase): PolicyStore {
  const selectRules = db.prepare('SELECT * FROM policy_rules ORDER BY priority')
  const selectRule = db.prepare('SELECT * FROM policy_rules WHERE id = ?')
  const upsertRule = db.prepare(`INSERT INTO policy_rules
    (id, match_json, action, reason, scope, priority, created_at, updated_at)
    VALUES (@id, @match_json, @action, @reason, @scope, @priority, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      match_json = @match_json, action = @action, reason = @reason,
      scope = @scope, priority = @priority, updated_at = @updated_at`)
  const deleteRule = db.prepare('DELETE FROM policy_rules WHERE id = ?')

  const selectDecisions = db.prepare(
    'SELECT * FROM policy_decisions WHERE expires_at IS NULL OR expires_at > ?'
  )
  const upsertDecision = db.prepare(`INSERT INTO policy_decisions
    (tool_name, fingerprint, decision, scope_target_id, decided_at, expires_at)
    VALUES (@tool_name, @fingerprint, @decision, @scope_target_id, @decided_at, @expires_at)
    ON CONFLICT(tool_name, fingerprint, scope_target_id) DO UPDATE SET
      decision = @decision, decided_at = @decided_at, expires_at = @expires_at`)
  const deleteDecision = db.prepare(
    'DELETE FROM policy_decisions WHERE tool_name = ? AND fingerprint = ? AND scope_target_id = ?'
  )

  const selectModes = db.prepare('SELECT conversation_id, mode FROM policy_modes')
  const upsertMode = db.prepare(`INSERT INTO policy_modes (conversation_id, mode, updated_at)
    VALUES (@conversation_id, @mode, @updated_at)
    ON CONFLICT(conversation_id) DO UPDATE SET
      mode = @mode, updated_at = @updated_at`)

  return {
    listRules() {
      return (selectRules.all() as PolicyRuleRow[]).flatMap((row) => {
        const rule = rowToRule(row)
        return rule ? [rule] : []
      })
    },
    saveRule(rule) {
      const now = Date.now()
      upsertRule.run({
        id: rule.id,
        match_json: JSON.stringify(rule.match),
        action: rule.action,
        reason: rule.reason ?? null,
        scope: rule.scope,
        priority: rule.priority,
        created_at: now,
        updated_at: now
      })
      const saved = rowToRule(selectRule.get([rule.id]) as PolicyRuleRow)
      if (!saved) {
        throw new TanzoValidationError(
          'POLICY_RULE_INVALID',
          `Policy rule "${rule.id}" is invalid.`
        )
      }
      return saved
    },
    deleteRule(id) {
      deleteRule.run([id])
    },
    listDecisions() {
      return (selectDecisions.all([Date.now()]) as PolicyDecisionRow[]).flatMap((row) => {
        const decision = rowToDecision(row)
        return decision ? [decision] : []
      })
    },
    saveDecision(decision) {
      upsertDecision.run({
        tool_name: decision.toolName,
        fingerprint: decision.inputFingerprint,
        decision: decision.decision,
        scope_target_id: decision.scopeTargetId ?? '',
        decided_at: decision.decidedAt,
        expires_at: decision.expiresAt ?? null
      })
    },
    revokeDecision(toolName, inputFingerprint, scopeTargetId) {
      deleteDecision.run([toolName, inputFingerprint, scopeTargetId ?? ''])
    },
    listModes() {
      return (selectModes.all() as Array<{ conversation_id: string; mode: string }>).flatMap(
        (row) => {
          const mode = permissionModeSchema.safeParse(row.mode)
          return mode.success ? [{ chatId: row.conversation_id, mode: mode.data }] : []
        }
      )
    },
    saveMode(chatId, mode) {
      upsertMode.run({ conversation_id: chatId, mode, updated_at: Date.now() })
    }
  }
}
