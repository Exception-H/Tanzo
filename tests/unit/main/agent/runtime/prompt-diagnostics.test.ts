import { describe, expect, it, vi } from 'vitest'
import {
  recordFinishedStepDiagnostic,
  recordPreparedStepDiagnostic
} from '@main/agent/runtime/prompt-diagnostics'
import type { AgentDefinition } from '@main/agent/agents/types'

vi.mock('@main/agent/diagnostics/prompt-cache', () => ({
  buildPromptCacheDiagnostic: vi.fn((input: unknown) => ({ built: input })),
  stableStringify: vi.fn((value: unknown) => JSON.stringify(value))
}))

const def: AgentDefinition = {
  id: 'main',
  name: 'Main',
  description: 'Main agent',
  kind: 'main',
  modelRef: 'anthropic:claude',
  systemPrompt: 'System',
  allowedTools: null
}

function createDeps() {
  return {
    store: {
      getLatestPromptDiagnostic: vi.fn(() => undefined),
      recordPromptDiagnostic: vi.fn(),
      finishPromptDiagnostic: vi.fn()
    },
    logger: { warn: vi.fn() }
  }
}

describe('main/agent/runtime/prompt-diagnostics', () => {
  it('records a prepared-step diagnostic from the built record', () => {
    const deps = createDeps()
    recordPreparedStepDiagnostic(deps as never, {
      chatId: 'chat-1',
      runId: 'run-1',
      stepNumber: 1,
      def,
      tools: { shell: {} } as never,
      prepared: { system: [], messages: [] }
    })

    expect(deps.store.recordPromptDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        built: expect.objectContaining({ conversationId: 'chat-1', runId: 'run-1', stepNumber: 1 })
      })
    )
  })

  it('maps unified usage cache fields onto the finished-step record', () => {
    const deps = createDeps()
    recordFinishedStepDiagnostic(deps as never, {
      chatId: 'chat-1',
      runId: 'run-1',
      stepNumber: 1,
      usage: {
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        inputTokenDetails: { cacheReadTokens: 80, cacheWriteTokens: 5 }
      },
      finishReason: 'stop'
    })

    expect(deps.store.finishPromptDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'chat-1',
        runId: 'run-1',
        stepNumber: 1,
        inputTokens: 100,
        cacheReadTokens: 80,
        cacheWriteTokens: 5
      })
    )
  })

  it('falls back to cachedInputTokens for cache reads', () => {
    const deps = createDeps()
    recordFinishedStepDiagnostic(deps as never, {
      chatId: 'chat-1',
      runId: 'run-1',
      stepNumber: 1,
      usage: { inputTokens: 100, cachedInputTokens: 40 }
    })

    expect(deps.store.finishPromptDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ cacheReadTokens: 40 })
    )
  })

  it('swallows record errors and warns', () => {
    const deps = createDeps()
    deps.store.recordPromptDiagnostic.mockImplementation(() => {
      throw new Error('db down')
    })

    expect(() =>
      recordPreparedStepDiagnostic(deps as never, {
        chatId: 'chat-1',
        runId: 'run-1',
        stepNumber: 1,
        def,
        tools: {} as never,
        prepared: {}
      })
    ).not.toThrow()
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'prompt cache diagnostic record failed',
      expect.objectContaining({ chatId: 'chat-1' })
    )
  })
})
