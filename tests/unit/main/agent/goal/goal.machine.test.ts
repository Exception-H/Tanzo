import { describe, expect, it } from 'vitest'
import { goalTransition } from '@main/agent/goal/goal.machine'
import type { ThreadGoal } from '@shared/goal'

function goal(overrides: Partial<ThreadGoal> = {}): ThreadGoal {
  return {
    chatId: 'c1',
    objective: 'X',
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
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

const TURN = {
  isGoalContinuation: false,
  producedWorkToolCall: true,
  turnTokens: 10,
  turnSeconds: 1,
  isPlanMode: false,
  suppressContinuation: false
}

describe('agent/goal/goal.machine', () => {
  it('is pure: does not mutate the input state', () => {
    const before = goal()
    const snapshot = structuredClone(before)
    goalTransition(before, { kind: 'turn-evaluated', turn: TURN })
    expect(before).toEqual(snapshot)
  })

  it('continues an active goal and arms a continuation injection', () => {
    const result = goalTransition(goal(), { kind: 'turn-evaluated', turn: TURN })
    expect(result.state.pendingInjection).toBe('continuation')
    expect(result.effects).toContainEqual({ kind: 'decision', continue: true })
  })

  it('flips to budget_limited and still wraps up when not suppressed', () => {
    const result = goalTransition(goal({ tokenBudget: 5 }), {
      kind: 'turn-evaluated',
      turn: { ...TURN, turnTokens: 6 }
    })
    expect(result.state.limit).toBe('budget')
    expect(result.state.pendingInjection).toBe('budget_limit')
    expect(result.effects).toContainEqual({ kind: 'decision', continue: true })
  })

  it('accounts but never continues a non-active goal (illegal continuation)', () => {
    const paused = goal({ userState: 'paused' })
    const result = goalTransition(paused, { kind: 'turn-evaluated', turn: TURN })
    expect(result.state.tokensUsed).toBe(10) // accounting still applied
    expect(result.effects).toContainEqual({ kind: 'decision', continue: false })
    expect(result.state.pendingInjection).toBeNull()
  })

  it('treats usage-limited on a completed goal as a no-op', () => {
    const done = goal({ outcome: 'complete' })
    const result = goalTransition(done, { kind: 'usage-limited' })
    expect(result.state).toBe(done)
    expect(result.effects).toEqual([])
  })

  it('resets streaks and re-arms continuation on resume', () => {
    const paused = goal({ userState: 'paused', idleStreak: 2, blockerStreak: 1 })
    const result = goalTransition(paused, { kind: 'user-resumed' })
    expect(result.state.userState).toBe('active')
    expect(result.state.idleStreak).toBe(0)
    expect(result.state.blockerStreak).toBe(0)
    expect(result.state.pendingInjection).toBe('continuation')
  })

  it('increments blockerStreak when marked blocked', () => {
    const result = goalTransition(goal({ blockerStreak: 1 }), {
      kind: 'outcome-marked',
      outcome: 'blocked'
    })
    expect(result.state.outcome).toBe('blocked')
    expect(result.state.blockerStreak).toBe(2)
  })
})
