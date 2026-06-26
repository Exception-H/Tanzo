import { describe, expect, it, vi } from 'vitest'
import type { ToolDeps } from '@main/agent/tools/types'
import { updateGoalTool } from '@main/agent/tools/goal'

function deps(overrides: Partial<ToolDeps['goal']> = {}): ToolDeps {
  return {
    goal: {
      get: vi.fn(() => null),
      markOutcome: vi.fn(() => true),
      ...overrides
    }
  } as unknown as ToolDeps
}

describe('main/agent/tools/goal', () => {
  it('marks the goal complete via markOutcome', async () => {
    const d = deps()

    const output = await (
      updateGoalTool(d, 'chat-1') as unknown as { execute: (input: unknown) => unknown }
    ).execute({ status: 'complete' })

    expect(output).toEqual({ updated: true, status: 'complete' })
    expect(d.goal.markOutcome).toHaveBeenCalledWith('chat-1', 'complete')
  })

  it('returns an error when no goal exists', async () => {
    const d = deps({ markOutcome: vi.fn(() => false) })

    const output = await (
      updateGoalTool(d, 'chat-1') as unknown as { execute: (input: unknown) => unknown }
    ).execute({ status: 'blocked' })

    expect(output).toMatchObject({ error: true })
  })
})
