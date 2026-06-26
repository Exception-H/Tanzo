import { randomUUID } from 'crypto'
import type { ModelMessage, ToolSet } from 'ai'
import type { AgentDefinition } from '../agents/types'
import type { ContextPromptProvenance } from '../context/section'
import { buildPromptCacheDiagnostic, stableStringify } from '../diagnostics/prompt-cache'
import type { AgentStore } from '../store-types'
import type { Logger } from './types'
import type { UsageLike } from './stream-runner'

export interface PromptDiagnosticDeps {
  store: AgentStore
  logger?: Logger
}

export interface PreparedDiagnosticInput {
  system?: ModelMessage[]
  messages?: ModelMessage[]
  providerOptions?: Record<string, unknown>
  provenance?: ContextPromptProvenance
}

export function recordPreparedStepDiagnostic(
  deps: PromptDiagnosticDeps,
  input: {
    chatId: string
    runId: string
    stepNumber: number
    def: AgentDefinition
    tools: ToolSet
    prepared: PreparedDiagnosticInput
  }
): void {
  try {
    deps.store.recordPromptDiagnostic(
      buildPromptCacheDiagnostic({
        id: randomUUID(),
        conversationId: input.chatId,
        runId: input.runId,
        stepNumber: input.stepNumber,
        createdAt: Date.now(),
        def: input.def,
        tools: input.tools,
        prepared: input.prepared,
        previous: deps.store.getLatestPromptDiagnostic(input.chatId)
      })
    )
  } catch (error) {
    deps.logger?.warn('prompt cache diagnostic record failed', {
      chatId: input.chatId,
      runId: input.runId,
      stepNumber: input.stepNumber,
      error
    })
  }
}

export function recordFinishedStepDiagnostic(
  deps: PromptDiagnosticDeps,
  input: {
    chatId: string
    runId: string
    stepNumber: number
    usage?: UsageLike
    finishReason?: string
    providerMetadata?: Record<string, unknown>
  }
): void {
  try {
    deps.store.finishPromptDiagnostic({
      conversationId: input.chatId,
      runId: input.runId,
      stepNumber: input.stepNumber,
      usageJson: input.usage ? stableStringify(input.usage) : undefined,
      finishReason: input.finishReason,
      providerMetadataJson: input.providerMetadata
        ? stableStringify(input.providerMetadata)
        : undefined,
      inputTokens: input.usage?.inputTokens,
      outputTokens: input.usage?.outputTokens,
      totalTokens: input.usage?.totalTokens,
      cacheReadTokens:
        input.usage?.inputTokenDetails?.cacheReadTokens ?? input.usage?.cachedInputTokens,
      cacheWriteTokens: input.usage?.inputTokenDetails?.cacheWriteTokens
    })
  } catch (error) {
    deps.logger?.warn('prompt cache diagnostic finish failed', {
      chatId: input.chatId,
      runId: input.runId,
      stepNumber: input.stepNumber,
      error
    })
  }
}
