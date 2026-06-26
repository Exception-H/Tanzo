import { randomUUID } from 'crypto'
import { convertToModelMessages } from 'ai'
import type { TanzoDataParts, TanzoUIMessage } from '@shared/agent-message'
import type { CompactionOutcome } from '@shared/chat'
import { TanzoError } from '@shared/errors'
import type { AgentDefinition } from '../agents/types'
import type { ContextEngine } from '../context'
import { buildCompactionResult, planCompaction } from '../context/compact/compact'
import { COMPACT_PROMPT } from '../context/compact/prompt'
import { runCompactionFork } from '../context/compact/fork-agent'
import { createAgentTelemetry } from '../telemetry'
import type { AgentRuntimeDeps, Logger } from './types'

export type CompactionRunLifecycle = <T>(
  chatId: string,
  runId: string,
  baseMessages: TanzoUIMessage[],
  executor: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal
) => Promise<T>

export interface CompactionCoordinator {
  prepareMessages(
    chatId: string,
    def: AgentDefinition,
    incoming: TanzoUIMessage[],
    runId: string,
    options?: { force?: boolean; signal?: AbortSignal }
  ): Promise<TanzoUIMessage[]>
  compactAfterRun(
    chatId: string,
    def: AgentDefinition,
    state: { exceededCompactionTrigger: boolean; hitCompactionTrigger: boolean },
    options?: { signal?: AbortSignal }
  ): Promise<boolean>
  compact(chatId: string, options?: { instructions?: string }): Promise<CompactionOutcome>
}

interface CompactionRunResult {
  outcome: CompactionOutcome
  next: TanzoUIMessage[] | null
}

export function createCompactionCoordinator(
  deps: AgentRuntimeDeps & {
    logger?: Logger
    contextEngine?: ContextEngine
    runLifecycle?: CompactionRunLifecycle
  }
): CompactionCoordinator {
  function createCompactionTelemetry(chatId: string, runId: string, broadcast: boolean) {
    return createAgentTelemetry({
      runId,
      chatId,
      scope: 'compaction',
      send: deps.send,
      broadcast,
      ...(deps.logger ? { logger: deps.logger } : {})
    })
  }

  function compactionData(summary: TanzoUIMessage): TanzoDataParts['compaction'] | undefined {
    const part = summary.parts.find((p) => p.type === 'data-compaction')
    return part?.type === 'data-compaction' ? part.data : undefined
  }

  function publishCompactionStatus(
    chatId: string,
    runId: string,
    data: TanzoDataParts['compaction'],
    frameRunId?: string
  ): void {
    deps.send(
      chatId,
      {
        type: 'data-compaction',
        id: `compaction:${data.summaryId ?? runId}`,
        data,
        transient: true
      },
      frameRunId ? { runId: frameRunId } : undefined
    )
  }

  async function publishCompactionEvents(
    chatId: string,
    def: AgentDefinition,
    engine: ContextEngine,
    runId: string,
    result: { summary: TanzoUIMessage; next: TanzoUIMessage[] },
    frameRunId?: string
  ): Promise<void> {
    const data = compactionData(result.summary)
    if (data) publishCompactionStatus(chatId, runId, data, frameRunId)
    try {
      const modelMessages = await convertToModelMessages(result.next, {
        ignoreIncompleteToolCalls: true
      })
      deps.send(
        chatId,
        {
          type: 'data-context',
          id: `context:${chatId}`,
          data: engine.snapshot(def, chatId, modelMessages),
          transient: true
        },
        frameRunId ? { runId: frameRunId } : undefined
      )
    } catch (error) {
      deps.logger?.warn('compaction context snapshot publish failed', { chatId, error })
    }
  }

  function compactionPrompt(instructions: string | undefined): string {
    const trimmed = instructions?.trim()
    if (!trimmed) return COMPACT_PROMPT
    return `${COMPACT_PROMPT}\n\nAdditional user instructions for this compaction:\n${trimmed}`
  }

  async function runCompaction(
    chatId: string,
    def: AgentDefinition,
    incoming: TanzoUIMessage[],
    auto: boolean,
    instructions?: string,
    runId: string = randomUUID(),
    options?: { retainedRecentSteps?: number; signal?: AbortSignal }
  ): Promise<CompactionRunResult> {
    const engine = deps.contextEngine
    if (!engine) return { outcome: 'not-needed', next: null }
    const summaryId = randomUUID()
    const compactionRunId = `${runId}:compaction:${summaryId}`
    const expectedActiveIds = incoming
      .filter((message) => message.parts.length > 0)
      .map((message) => message.id)

    const retainedRecentSteps = options?.retainedRecentSteps ?? engine.retainedRecentSteps(def)
    const plan = await planCompaction(incoming, retainedRecentSteps)
    if (!plan) return { outcome: 'not-needed', next: null }

    const execute = async (signal: AbortSignal): Promise<CompactionRunResult> => {
      const telemetry = createCompactionTelemetry(chatId, compactionRunId, true)
      try {
        publishCompactionStatus(chatId, runId, { stage: 'start', auto, summaryId }, compactionRunId)
        const forkResult = await runCompactionFork(
          { ...deps, contextEngine: engine },
          {
            chatId,
            def,
            cwd: deps.store.getConversation(chatId)?.cwd ?? process.cwd(),
            runId: compactionRunId,
            head: plan.sourceMessages,
            prompt: compactionPrompt(instructions),
            telemetry: telemetry.options,
            abortSignal: signal,
            onSummary: (summary) => {
              publishCompactionStatus(
                chatId,
                runId,
                {
                  stage: 'start',
                  auto,
                  summaryId,
                  summary
                },
                compactionRunId
              )
            }
          }
        )
        if (signal.aborted) {
          return { outcome: 'aborted', next: null }
        }
        const result = buildCompactionResult({
          plan,
          summaryText: forkResult.text,
          summaryId,
          auto,
          ...(forkResult.usage ? { usage: forkResult.usage } : {})
        })
        deps.store.finalizeCompaction(
          chatId,
          result.archivedIds,
          result.summary.id,
          result.next,
          expectedActiveIds
        )
        engine.clear(chatId)
        await publishCompactionEvents(chatId, def, engine, runId, result, compactionRunId)
        deps.logger?.info('compacted conversation', {
          chatId,
          ...(result.beforeTokens !== undefined ? { beforeTokens: result.beforeTokens } : {}),
          ...(result.afterTokens !== undefined ? { afterTokens: result.afterTokens } : {})
        })
        return { outcome: 'compacted', next: result.next }
      } catch (error) {
        if (signal.aborted) {
          return { outcome: 'aborted', next: null }
        }
        if (error instanceof TanzoError && error.code === 'CHAT_COMPACTION_STALE') {
          deps.logger?.warn('compaction skipped: conversation changed while compacting', { chatId })
          publishCompactionStatus(
            chatId,
            runId,
            {
              stage: 'failed',
              auto,
              summaryId,
              summary: 'Conversation changed during compaction; nothing was archived.'
            },
            compactionRunId
          )
          return { outcome: 'stale', next: null }
        }
        deps.logger?.warn('compaction failed', { chatId, error })
        publishCompactionStatus(
          chatId,
          runId,
          {
            stage: 'failed',
            auto,
            summaryId,
            summary: error instanceof Error ? error.message : String(error)
          },
          compactionRunId
        )
        throw error
      }
    }

    if (!deps.runLifecycle) return execute(options?.signal ?? new AbortController().signal)
    return deps.runLifecycle(chatId, compactionRunId, incoming, execute, options?.signal)
  }

  return {
    async prepareMessages(chatId, def, incoming, runId, options) {
      const engine = deps.contextEngine
      if (!engine) return incoming
      if (!options?.force) {
        const model = await convertToModelMessages(incoming, { ignoreIncompleteToolCalls: true })
        if (!engine.shouldCompact(def, chatId, model)) return incoming
      }
      const result = await runCompaction(chatId, def, incoming, true, undefined, runId, {
        ...(options?.signal ? { signal: options.signal } : {})
      })
      return result.next ?? incoming
    },
    async compactAfterRun(chatId, def, state, options) {
      if (!state.exceededCompactionTrigger || state.hitCompactionTrigger) return false
      if (options?.signal?.aborted) return false
      if (!deps.store.getConversation(chatId)) return false
      const result = await runCompaction(
        chatId,
        def,
        await deps.store.load(chatId),
        true,
        undefined,
        randomUUID(),
        { ...(options?.signal ? { signal: options.signal } : {}) }
      )
      return result.outcome === 'compacted'
    },
    async compact(chatId, options) {
      const def = await deps.store.resolveAgentDefinition(chatId)
      const incoming = await deps.store.load(chatId)
      const result = await runCompaction(chatId, def, incoming, false, options?.instructions)
      return result.outcome
    }
  }
}
