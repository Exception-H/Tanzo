import { describe, expect, it } from 'vitest'
import type { ThreadGoal } from '@shared/goal'
import {
  budgetLimitPrompt,
  continuationPrompt,
  objectiveUpdatedPrompt
} from '@main/agent/goal/templates'

function goal(overrides: Partial<ThreadGoal> = {}): ThreadGoal {
  return {
    chatId: 'c1',
    objective: 'Write 5 joke files',
    userState: 'active',
    outcome: null,
    limit: null,
    tokenBudget: null,
    tokensUsed: 0,
    timeBudgetSeconds: null,
    timeUsedSeconds: 0,
    idleStreak: 0,
    blockerStreak: 0,
    pendingInjection: 'continuation',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('agent/goal/templates', () => {
  it('wraps the objective and budget in every prompt', () => {
    const prompt = continuationPrompt(goal({ tokenBudget: 1000, tokensUsed: 250 }))
    expect(prompt).toContain('<goal_context>')
    expect(prompt).toContain('<objective>\nWrite 5 joke files\n</objective>')
    expect(prompt).toContain('Tokens used: 250')
    expect(prompt).toContain('Tokens remaining: 750')
  })

  it('uses the steady prompt when no idle streak', () => {
    const prompt = continuationPrompt(goal({ idleStreak: 0 }))
    expect(prompt).toContain('do exactly one')
    expect(prompt).not.toContain('Your previous turn changed nothing')
  })

  it('escalates to the stalled prompt once a turn made no changes', () => {
    const prompt = continuationPrompt(goal({ idleStreak: 1 }))
    expect(prompt).toContain('Your previous turn changed nothing')
    expect(prompt).toContain('re-reading the same files is not progress')
    expect(prompt).toContain('not a valid turn')
  })

  it('keeps escalating while the streak persists', () => {
    expect(continuationPrompt(goal({ idleStreak: 3 }))).toContain('Decide now')
  })

  it('budget-limit prompt tells the model to wrap up', () => {
    const prompt = budgetLimitPrompt(goal({ tokenBudget: 100, tokensUsed: 120 }))
    expect(prompt).toContain('budget_limited')
    expect(prompt).toContain("Don't start new substantive work")
  })

  it('objective-updated prompt supersedes the old objective', () => {
    const prompt = objectiveUpdatedPrompt(goal({ objective: 'New objective' }))
    expect(prompt).toContain('replaces any earlier objective')
    expect(prompt).toContain('<objective>\nNew objective\n</objective>')
  })

  it('references the registered updateGoal tool, never a snake_case name', () => {
    const prompts = [
      continuationPrompt(goal({ idleStreak: 0 })),
      continuationPrompt(goal({ idleStreak: 1 })),
      budgetLimitPrompt(goal()),
      objectiveUpdatedPrompt(goal())
    ]
    for (const prompt of prompts) {
      expect(prompt).not.toContain('update_goal')
    }
    expect(continuationPrompt(goal({ idleStreak: 0 }))).toContain('updateGoal(status="complete")')
  })
})
