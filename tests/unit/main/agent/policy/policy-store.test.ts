import { describe, expect, it, vi } from 'vitest'
import { TanzoValidationError } from '@shared/errors'
import type { SqlDatabase } from '@main/database/types'
import { createPolicyStore } from '@main/agent/policy/policy-store'
import { countRows, createRealDb } from '../../../../helpers/real-db'

type RuleRow = {
  id: string
  match_json: string
  action: string
  reason: string | null
  scope: string
  priority: number
  created_at: number
  updated_at: number
}

type DecisionRow = {
  tool_name: string
  fingerprint: string
  decision: string
  scope_target_id: string
  decided_at: number
  expires_at: number | null
}

function createDb(): SqlDatabase & {
  rules: Map<string, RuleRow>
  decisions: Map<string, DecisionRow>
} {
  const rules = new Map<string, RuleRow>()
  const decisions = new Map<string, DecisionRow>()
  const key = (toolName: string, fingerprint: string, scopeTargetId = '') =>
    `${toolName}:${fingerprint}:${scopeTargetId}`

  return {
    rules,
    decisions,
    exec: vi.fn(),
    pragma: vi.fn(),
    close: vi.fn(),
    transaction: (fn) => fn(),
    prepare(sql: string) {
      return {
        all(params?: unknown) {
          if (sql.startsWith('SELECT * FROM policy_rules')) {
            return [...rules.values()].sort((left, right) => left.priority - right.priority)
          }
          if (sql.startsWith('SELECT * FROM policy_decisions')) {
            const [now] = params as [number]
            return [...decisions.values()].filter(
              (row) => row.expires_at === null || row.expires_at > now
            )
          }
          return []
        },
        get(params?: unknown) {
          if (sql.startsWith('SELECT * FROM policy_rules WHERE id')) {
            const [id] = params as [string]
            return rules.get(id)
          }
          return undefined
        },
        run(params?: unknown) {
          if (sql.includes('INSERT INTO policy_rules')) {
            const row = params as RuleRow
            const previous = rules.get(row.id)
            rules.set(row.id, {
              ...row,
              created_at: previous?.created_at ?? row.created_at
            })
          } else if (sql.startsWith('DELETE FROM policy_rules')) {
            const [id] = params as [string]
            rules.delete(id)
          } else if (sql.includes('INSERT INTO policy_decisions')) {
            const row = params as {
              tool_name: string
              fingerprint: string
              decision: string
              scope_target_id: string
              decided_at: number
              expires_at: number | null
            }
            decisions.set(key(row.tool_name, row.fingerprint, row.scope_target_id), row)
          } else if (sql.startsWith('DELETE FROM policy_decisions')) {
            const [toolName, fingerprint, scopeTargetId] = params as [string, string, string]
            decisions.delete(key(toolName, fingerprint, scopeTargetId))
          }
          return { changes: 1 }
        }
      }
    }
  }
}

describe('agent/policy/policy-store', () => {
  it('persists, lists, updates, and deletes policy rules', () => {
    const db = createDb()
    db.rules.set('bad-json', {
      id: 'bad-json',
      match_json: '{',
      action: 'allow',
      reason: null,
      scope: 'user',
      priority: 0,
      created_at: 1,
      updated_at: 1
    })
    db.rules.set('bad-action', {
      id: 'bad-action',
      match_json: '{"toolName":"shell"}',
      action: 'maybe',
      reason: null,
      scope: 'user',
      priority: 1,
      created_at: 1,
      updated_at: 1
    })
    const store = createPolicyStore(db)

    const saved = store.saveRule({
      id: 'rule-1',
      match: { toolNameGlob: 'file*', argMatch: { path: 'path', equals: 'README.md' } },
      action: 'ask',
      reason: 'needs review',
      scope: 'project',
      priority: 10
    })
    expect(saved).toMatchObject({
      id: 'rule-1',
      match: { toolNameGlob: 'file*', argMatch: { path: 'path', equals: 'README.md' } },
      action: 'ask',
      reason: 'needs review',
      source: 'user',
      scope: 'project',
      priority: 10
    })
    expect(store.listRules()).toEqual([saved])

    const updated = store.saveRule({
      id: 'rule-1',
      match: { toolName: 'shell' },
      action: 'deny',
      scope: 'user',
      priority: 2
    })
    expect(updated).toMatchObject({
      id: 'rule-1',
      match: { toolName: 'shell' },
      action: 'deny',
      scope: 'user',
      priority: 2
    })

    store.deleteRule('rule-1')
    expect(store.listRules()).toEqual([])
  })

  it('persists active decisions, skips expired/invalid rows, and revokes decisions', () => {
    const db = createDb()
    const store = createPolicyStore(db)
    const now = Date.now()
    db.decisions.set('expired', {
      tool_name: 'shell',
      fingerprint: 'expired',
      decision: 'approved',
      scope_target_id: '',
      decided_at: now - 100,
      expires_at: now - 1
    })
    db.decisions.set('invalid', {
      tool_name: 'shell',
      fingerprint: 'invalid',
      decision: 'maybe',
      scope_target_id: '',
      decided_at: now,
      expires_at: null
    })

    store.saveDecision({
      toolName: 'fileEdit',
      inputFingerprint: 'abc',
      decision: 'denied',
      scope: 'session',
      decidedAt: now,
      expiresAt: now + 1000
    })
    store.saveDecision({
      toolName: 'fileEdit',
      inputFingerprint: 'abc',
      decision: 'approved',
      scope: 'forever',
      scopeTargetId: 'ws-b',
      decidedAt: now
    })
    store.saveDecision({
      toolName: 'fileRead',
      inputFingerprint: 'forever',
      decision: 'approved',
      scope: 'forever',
      decidedAt: now
    })

    expect(store.listDecisions()).toEqual([
      {
        toolName: 'fileEdit',
        inputFingerprint: 'abc',
        decision: 'denied',
        scope: 'forever',
        decidedAt: now,
        expiresAt: now + 1000
      },
      {
        toolName: 'fileEdit',
        inputFingerprint: 'abc',
        decision: 'approved',
        scope: 'forever',
        decidedAt: now,
        scopeTargetId: 'ws-b'
      },
      {
        toolName: 'fileRead',
        inputFingerprint: 'forever',
        decision: 'approved',
        scope: 'forever',
        decidedAt: now
      }
    ])

    store.revokeDecision('fileEdit', 'abc')
    expect(store.listDecisions().map((decision) => decision.scopeTargetId ?? '')).toEqual([
      'ws-b',
      ''
    ])

    store.revokeDecision('fileEdit', 'abc', 'ws-b')
    expect(store.listDecisions().map((decision) => decision.inputFingerprint)).toEqual(['forever'])
  })

  it('throws when a saved rule cannot be parsed back from storage', () => {
    const db = createDb()
    const store = createPolicyStore(db)

    expect(() =>
      store.saveRule({
        id: 'bad',
        match: { toolName: 'shell' },
        action: 'bogus' as never,
        scope: 'user',
        priority: 1
      })
    ).toThrow(TanzoValidationError)
  })

  it('persists per-chat permission modes on real sqlite and rejects invalid modes', () => {
    const db = createRealDb()
    db.exec(`
      INSERT INTO workspaces (id, name, root_path, created_at, updated_at)
      VALUES ('ws', 'ws', '/w', 1, 1);
      INSERT INTO conversations (id, workspace_id, created_at, updated_at)
      VALUES ('chat-1', 'ws', 1, 1), ('chat-2', 'ws', 1, 1);
    `)
    const store = createPolicyStore(db)

    store.saveMode('chat-1', 'yolo')
    store.saveMode('chat-2', 'plan')
    store.saveMode('chat-1', 'dangerous')
    expect(store.listModes()).toEqual([
      { chatId: 'chat-1', mode: 'dangerous' },
      { chatId: 'chat-2', mode: 'plan' }
    ])

    expect(() =>
      db
        .prepare('UPDATE policy_modes SET mode = ? WHERE conversation_id = ?')
        .run(['bogus', 'chat-2'])
    ).toThrow()
    expect(store.listModes()).toEqual([
      { chatId: 'chat-1', mode: 'dangerous' },
      { chatId: 'chat-2', mode: 'plan' }
    ])

    db.prepare('DELETE FROM conversations WHERE id = ?').run(['chat-1'])
    expect(countRows(db, 'policy_modes')).toBe(1)
    expect(store.listModes()).toEqual([{ chatId: 'chat-2', mode: 'plan' }])
  })
})
