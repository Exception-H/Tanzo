import { describe, expect, it } from 'vitest'
import type { SqlDatabase } from '@main/database/types'
import { createGoalStore } from '@main/agent/goal/store'
import type { ThreadGoal } from '@shared/goal'

function fakeDb(): SqlDatabase {
  const rows = new Map<string, Record<string, unknown>>()

  function prepare(sql: string): {
    run(p?: Record<string, unknown> | unknown[]): void
    get(p?: Record<string, unknown> | unknown[]): unknown
    all(p?: Record<string, unknown> | unknown[]): unknown[]
  } {
    const isInsert = sql.includes('INSERT INTO conversation_goals')
    const isSelect = sql.startsWith('SELECT')
    const isDelete = sql.startsWith('DELETE')
    return {
      run(params) {
        if (isInsert && params && !Array.isArray(params)) {
          rows.set(String(params.conversation_id), { ...params })
        } else if (isDelete && Array.isArray(params)) {
          rows.delete(String(params[0]))
        }
      },
      get(params) {
        if (isSelect && Array.isArray(params)) return rows.get(String(params[0])) ?? undefined
        return undefined
      },
      all() {
        return []
      }
    }
  }

  return {
    exec: () => undefined,
    prepare,
    transaction: <T>(fn: () => T): T => fn(),
    pragma: () => undefined,
    close: () => undefined
  }
}

function baseGoal(overrides: Partial<ThreadGoal> = {}): ThreadGoal {
  return {
    chatId: 'c1',
    objective: 'Ship it',
    userState: 'active',
    outcome: null,
    limit: null,
    tokenBudget: null,
    tokensUsed: 0,
    timeBudgetSeconds: null,
    timeUsedSeconds: 0,
    idleStreak: 0,
    blockerStreak: 0,
    pendingInjection: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('agent/goal/store', () => {
  it('upserts and reads back a goal', () => {
    const store = createGoalStore(fakeDb())
    store.upsert(baseGoal({ tokenBudget: 5000, pendingInjection: 'continuation' }))
    expect(store.get('c1')).toMatchObject({
      chatId: 'c1',
      objective: 'Ship it',
      userState: 'active',
      tokenBudget: 5000,
      pendingInjection: 'continuation'
    })
  })

  it('patches token and time usage', () => {
    const store = createGoalStore(fakeDb())
    store.upsert(baseGoal({ tokensUsed: 10, timeUsedSeconds: 5 }))
    const goal = store.patch('c1', { tokensUsed: 50, timeUsedSeconds: 12 })
    expect(goal?.tokensUsed).toBe(50)
    expect(goal?.timeUsedSeconds).toBe(12)
  })

  it('patches orthogonal state fields and clears', () => {
    const store = createGoalStore(fakeDb())
    store.upsert(baseGoal())
    const completed = store.patch('c1', { outcome: 'complete' })
    expect(completed?.outcome).toBe('complete')
    store.clear('c1')
    expect(store.get('c1')).toBeNull()
  })

  it('returns null for patch on missing goal', () => {
    const store = createGoalStore(fakeDb())
    expect(store.patch('missing', { userState: 'paused' })).toBeNull()
  })
})
