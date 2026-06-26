import { describe, expect, it } from 'vitest'
import {
  decideTurnOutcome,
  MAX_CONTINUATION_PASSES,
  MAX_PLAN_EXIT_PASSES,
  type TurnDecisionContext
} from '@main/agent/runtime/turn-loop.machine'
import type { AgentStreamFinalState } from '@main/agent/runtime/stream-runner'

function state(overrides: Partial<AgentStreamFinalState> = {}): AgentStreamFinalState {
  return {
    producedToolCall: false,
    producedWorkToolCall: false,
    streamFailed: false,
    aborted: false,
    turnStartedAt: 0,
    exceededCompactionTrigger: false,
    hitCompactionTrigger: false,
    isGoalContinuation: false,
    exitPlanModeCalled: false,
    endedWithTextOnly: false,
    ...overrides
  }
}

function ctx(overrides: Partial<TurnDecisionContext> = {}): TurnDecisionContext {
  return {
    pass: 0,
    planExitPasses: 0,
    isPlanMode: false,
    isInflight: false,
    hasConversation: true,
    ...overrides
  }
}

describe('agent/runtime/turn-loop.machine', () => {
  it('retries for a plan-mode text-only answer that never called exitPlanMode', () => {
    const decision = decideTurnOutcome(
      state({ endedWithTextOnly: true }),
      ctx({ isPlanMode: true })
    )
    expect(decision).toEqual({ kind: 'plan-exit-retry' })
  })

  it('stops plan-exit retries once the cap is reached', () => {
    const decision = decideTurnOutcome(
      state({ endedWithTextOnly: true }),
      ctx({ isPlanMode: true, planExitPasses: MAX_PLAN_EXIT_PASSES })
    )
    expect(decision.kind).not.toBe('plan-exit-retry')
  })

  it('does not plan-exit-retry when exitPlanMode was called', () => {
    const decision = decideTurnOutcome(
      state({ endedWithTextOnly: true, exitPlanModeCalled: true }),
      ctx({ isPlanMode: true })
    )
    expect(decision.kind).toBe('finalize')
  })

  it('retries after a compaction trigger within the pass budget', () => {
    const decision = decideTurnOutcome(state({ hitCompactionTrigger: true }), ctx({ pass: 3 }))
    expect(decision).toEqual({ kind: 'compaction-retry' })
  })

  it('stops compaction retries at the pass budget and finalizes', () => {
    const decision = decideTurnOutcome(
      state({ hitCompactionTrigger: true, exceededCompactionTrigger: true }),
      ctx({ pass: MAX_CONTINUATION_PASSES })
    )
    expect(decision).toEqual({ kind: 'finalize' })
  })

  it('post-compacts when the trigger was exceeded without a mid-turn cut', () => {
    const decision = decideTurnOutcome(state({ exceededCompactionTrigger: true }), ctx())
    expect(decision).toEqual({ kind: 'post-compact' })
  })

  it('finalizes a normal turn', () => {
    const decision = decideTurnOutcome(state(), ctx())
    expect(decision).toEqual({ kind: 'finalize' })
  })

  it('finalizes (no retry) when aborted, even in plan mode', () => {
    const decision = decideTurnOutcome(
      state({ aborted: true, endedWithTextOnly: true }),
      ctx({ isPlanMode: true })
    )
    expect(decision).toEqual({ kind: 'finalize' })
  })

  it('finalizes (no retry) when the stream failed', () => {
    const decision = decideTurnOutcome(
      state({ streamFailed: true, hitCompactionTrigger: true }),
      ctx()
    )
    expect(decision).toEqual({ kind: 'finalize' })
  })

  it('does not retry when another run is already inflight', () => {
    const decision = decideTurnOutcome(
      state({ hitCompactionTrigger: true }),
      ctx({ isInflight: true })
    )
    expect(decision.kind).toBe('finalize')
  })
})
