import type { CreateGoalInput, GoalInjection, GoalUserStatusChange, ThreadGoal } from '@shared/goal'
import type { GoalStore } from './store'
import { goalTransition, type GoalEffect, type GoalEvent, type GoalTurnInput } from './goal.machine'

export type { GoalTurnInput } from './goal.machine'

export interface GoalDecision {
  continue: boolean
}

export interface GoalServiceDeps {
  store: GoalStore
  broadcast: (chatId: string, goal: ThreadGoal | null) => void
}

export interface GoalService {
  get(chatId: string): ThreadGoal | null
  create(chatId: string, input: CreateGoalInput): ThreadGoal
  updateObjective(chatId: string, objective: string): ThreadGoal
  setUserState(chatId: string, status: GoalUserStatusChange): ThreadGoal
  clear(chatId: string): void
  markOutcome(chatId: string, outcome: 'complete' | 'blocked'): ThreadGoal | null
  markUsageLimited(chatId: string): void
  evaluate(chatId: string, input: GoalTurnInput): GoalDecision
  peekInjection(chatId: string): GoalInjection | null
  takeInjection(chatId: string): GoalInjection | null
}

function normalizeObjective(objective: string): string {
  const trimmed = objective.trim()
  if (!trimmed) throw new Error('Goal objective is required.')
  return trimmed
}

export function createGoalService(deps: GoalServiceDeps): GoalService {
  function emit(chatId: string, goal: ThreadGoal | null): void {
    deps.broadcast(chatId, goal)
  }

  /**
   * Interpreter shell: run the pure transition for an existing goal, then apply
   * its effects (persist with a fresh updatedAt, broadcast). Returns the
   * resulting goal and the continuation decision, if any.
   */
  function dispatch(
    chatId: string,
    event: GoalEvent
  ): { goal: ThreadGoal | null; decision: GoalDecision } {
    const existing = deps.store.get(chatId)
    if (!existing) return { goal: null, decision: { continue: false } }
    const result = goalTransition(existing, event)
    let goal: ThreadGoal | null = existing
    let decision: GoalDecision = { continue: false }
    for (const effect of result.effects) {
      goal = applyEffect(chatId, result.state, effect, goal)
      if (effect.kind === 'decision') decision = { continue: effect.continue }
    }
    return { goal, decision }
  }

  function applyEffect(
    chatId: string,
    nextState: ThreadGoal,
    effect: GoalEffect,
    current: ThreadGoal | null
  ): ThreadGoal | null {
    switch (effect.kind) {
      case 'persist':
        return deps.store.upsert({ ...nextState, updatedAt: Date.now() })
      case 'broadcast':
        emit(chatId, current)
        return current
      case 'decision':
        return current
      default:
        return current
    }
  }

  function create(chatId: string, input: CreateGoalInput): ThreadGoal {
    if (deps.store.get(chatId)) throw new Error('This conversation already has a goal.')
    const now = Date.now()
    const goal: ThreadGoal = {
      chatId,
      objective: normalizeObjective(input.objective),
      userState: 'active',
      outcome: null,
      limit: null,
      tokenBudget: input.tokenBudget ?? null,
      tokensUsed: 0,
      timeBudgetSeconds: input.timeBudgetSeconds ?? null,
      timeUsedSeconds: 0,
      idleStreak: 0,
      blockerStreak: 0,
      pendingInjection: 'continuation',
      createdAt: now,
      updatedAt: now
    }
    const saved = deps.store.upsert(goal)
    emit(chatId, saved)
    return saved
  }

  function updateObjective(chatId: string, objective: string): ThreadGoal {
    const existing = deps.store.get(chatId)
    if (!existing) return create(chatId, { objective })
    const { goal } = dispatch(chatId, {
      kind: 'objective-updated',
      objective: normalizeObjective(objective)
    })
    return goal ?? existing
  }

  function setUserState(chatId: string, status: GoalUserStatusChange): ThreadGoal {
    const existing = deps.store.get(chatId)
    if (!existing) throw new Error('No goal for this conversation.')
    const { goal } = dispatch(
      chatId,
      status === 'active' ? { kind: 'user-resumed' } : { kind: 'user-paused' }
    )
    return goal ?? existing
  }

  function clear(chatId: string): void {
    deps.store.clear(chatId)
    emit(chatId, null)
  }

  function markOutcome(chatId: string, outcome: 'complete' | 'blocked'): ThreadGoal | null {
    if (!deps.store.get(chatId)) return null
    const { goal } = dispatch(chatId, { kind: 'outcome-marked', outcome })
    return goal
  }

  function markUsageLimited(chatId: string): void {
    dispatch(chatId, { kind: 'usage-limited' })
  }

  function evaluate(chatId: string, input: GoalTurnInput): GoalDecision {
    const { decision } = dispatch(chatId, { kind: 'turn-evaluated', turn: input })
    return decision
  }

  return {
    get: (chatId) => deps.store.get(chatId),
    create,
    updateObjective,
    setUserState,
    clear,
    markOutcome,
    markUsageLimited,
    evaluate,
    peekInjection(chatId) {
      return deps.store.get(chatId)?.pendingInjection ?? null
    },
    takeInjection(chatId) {
      const goal = deps.store.get(chatId)
      if (!goal?.pendingInjection) return null
      const injection = goal.pendingInjection
      deps.store.patch(chatId, { pendingInjection: null })
      return injection
    }
  }
}
