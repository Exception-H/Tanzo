import type { Telemetry, TelemetryOptions } from 'ai'
import type { AgentTelemetryScope } from './events'
import {
  normalizeTelemetryUsage,
  numberField,
  recordField,
  stringField,
  type AgentTelemetryEmitInput,
  type AgentTelemetryEvent,
  type AgentTelemetryRawRecord,
  type AgentTelemetrySink
} from './events'
import { normalizeTelemetryError, retryTelemetryFromError } from './errors'
import { createRetryTracker } from './retry'
import { createLoggerTelemetrySink, createUiTelemetrySink, emitToSinks } from './sinks'
import type { ChunkSink, Logger } from '../runtime/types'

export interface AgentTelemetryController {
  runId: string
  options: TelemetryOptions
  emit(input: AgentTelemetryEmitInput, raw?: unknown): AgentTelemetryEvent
  emitError(error: unknown, raw?: unknown): AgentTelemetryEvent
  emitRaw(kind: string, raw: unknown): void
  flushChunkSummary(): void
}

export interface CreateAgentTelemetryInput {
  runId: string
  chatId?: string
  scope: AgentTelemetryScope
  send?: ChunkSink
  broadcast?: boolean
  logger?: Logger
  sinks?: AgentTelemetrySink[]
  recordInputs?: boolean
  recordOutputs?: boolean
  functionId?: string
}

interface ChunkStats {
  count: number
  firstTimestamp?: number
  lastTimestamp?: number
  firstChunkMs?: number
}

export function createAgentTelemetry(input: CreateAgentTelemetryInput): AgentTelemetryController {
  let sequence = 0
  let terminalErrorEmitted = false
  let terminalErrorEvent: AgentTelemetryEvent | undefined
  let operationStartedAt: number | undefined
  const stepStartedAt = new Map<number, number>()
  const modelCallStartedAt = new Map<string, number>()
  const toolStartedAt = new Map<string, number>()
  const retryTracker = createRetryTracker()
  const chunks: ChunkStats = { count: 0 }
  let lastChunkSummaryCount = 0
  const sinks: AgentTelemetrySink[] = [
    ...(input.send && input.chatId
      ? [
          createUiTelemetrySink({
            chatId: input.chatId,
            send: input.send,
            enabled: input.broadcast !== false
          })
        ]
      : []),
    createLoggerTelemetrySink(input.logger),
    ...(input.sinks ?? [])
  ]

  function timestamp(): number {
    return Date.now()
  }

  function emit(record: AgentTelemetryEmitInput, raw?: unknown): AgentTelemetryEvent {
    const data: AgentTelemetryEvent = {
      ...record,
      runId: input.runId,
      scope: record.scope ?? input.scope,
      sequence: ++sequence,
      timestamp: record.timestamp ?? timestamp(),
      ...((record.chatId ?? input.chatId) ? { chatId: record.chatId ?? input.chatId } : {})
    }
    emitToSinks(
      sinks,
      { data, ...(raw !== undefined ? { raw: rawRecord(record.event, raw) } : {}) },
      input.logger
    )
    return data
  }

  function rawRecord(kind: string, raw: unknown): AgentTelemetryRawRecord {
    return {
      runId: input.runId,
      scope: input.scope,
      ...(input.chatId ? { chatId: input.chatId } : {}),
      timestamp: timestamp(),
      kind,
      raw
    }
  }

  function emitRaw(kind: string, raw: unknown): void {
    emitToSinks(sinks, { raw: rawRecord(kind, raw) }, input.logger)
  }

  function flushChunkSummary(): void {
    if (chunks.count === 0) return
    if (chunks.count === lastChunkSummaryCount) return
    lastChunkSummaryCount = chunks.count
    emit({
      event: 'chunk-summary',
      chunks: {
        count: chunks.count,
        ...(chunks.firstTimestamp !== undefined ? { firstTimestamp: chunks.firstTimestamp } : {}),
        ...(chunks.lastTimestamp !== undefined ? { lastTimestamp: chunks.lastTimestamp } : {}),
        ...(chunks.firstChunkMs !== undefined ? { firstChunkMs: chunks.firstChunkMs } : {}),
        ...(chunks.firstTimestamp !== undefined && chunks.lastTimestamp !== undefined
          ? { durationMs: chunks.lastTimestamp - chunks.firstTimestamp }
          : {})
      }
    })
  }

  function emitError(error: unknown, raw?: unknown): AgentTelemetryEvent {
    if (terminalErrorEmitted && terminalErrorEvent) return terminalErrorEvent
    terminalErrorEmitted = true
    flushChunkSummary()
    const retry = retryTelemetryFromError(error)
    if (retry) {
      emit(
        {
          event: 'retry-exhausted',
          retry,
          error: normalizeTelemetryError(error)
        },
        raw ?? error
      )
    }
    terminalErrorEvent = emit(
      {
        event: 'operation-error',
        durationMs: operationStartedAt !== undefined ? timestamp() - operationStartedAt : undefined,
        error: normalizeTelemetryError(error)
      },
      raw ?? error
    )
    return terminalErrorEvent
  }

  function callKey(callId: string | undefined, attempt: number | undefined): string {
    return `${callId ?? 'unknown'}:${attempt ?? 1}`
  }

  function operationEventName(
    phase: 'start' | 'finish',
    operationId: string | undefined
  ): AgentTelemetryEvent['event'] {
    if (operationId?.startsWith('ai.embed'))
      return phase === 'start' ? 'embed-start' : 'embed-finish'
    if (operationId?.startsWith('ai.rerank')) {
      return phase === 'start' ? 'rerank-start' : 'rerank-finish'
    }
    return phase === 'start' ? 'operation-start' : 'operation-finish'
  }

  const integration: Telemetry = {
    onStart(event) {
      const raw = recordField(event)
      operationStartedAt = timestamp()
      retryTracker.startOperation(event)
      emit(
        {
          event: operationEventName('start', stringField(raw?.operationId)),
          operationId: stringField(raw?.operationId),
          callId: stringField(raw?.callId),
          provider: stringField(raw?.provider),
          modelId: stringField(raw?.modelId)
        },
        event
      )
    },
    onStepStart(event) {
      const raw = recordField(event)
      retryTracker.startStep(event)
      const stepNumber = numberField(raw?.stepNumber)
      if (stepNumber !== undefined) stepStartedAt.set(stepNumber, timestamp())
      emit(
        {
          event: 'step-start',
          callId: stringField(raw?.callId),
          ...(stepNumber !== undefined ? { stepNumber } : {}),
          provider: stringField(raw?.provider),
          modelId: stringField(raw?.modelId)
        },
        event
      )
    },
    onLanguageModelCallStart(event) {
      const raw = recordField(event)
      const attempt = retryTracker.startModelCall(event)
      const callId = stringField(raw?.callId)
      modelCallStartedAt.set(callKey(callId, attempt.attempt), timestamp())
      if (attempt.retry) {
        emit(
          {
            event: 'retry-attempt',
            callId,
            ...(attempt.stepNumber !== undefined ? { stepNumber: attempt.stepNumber } : {}),
            provider: stringField(raw?.provider),
            modelId: stringField(raw?.modelId),
            retry: attempt.retry
          },
          event
        )
      }
      emit(
        {
          event: 'model-call-start',
          callId,
          ...(attempt.stepNumber !== undefined ? { stepNumber: attempt.stepNumber } : {}),
          provider: stringField(raw?.provider),
          modelId: stringField(raw?.modelId),
          retry: {
            attempt: attempt.attempt,
            ...(attempt.maxRetries !== undefined ? { maxRetries: attempt.maxRetries } : {})
          }
        },
        event
      )
    },
    onLanguageModelCallEnd(event) {
      const raw = recordField(event)
      const callId = stringField(raw?.callId)
      const attempt = retryTracker.currentModelCall({ callId })
      const startedAt = modelCallStartedAt.get(callKey(callId, attempt.attempt))
      emit(
        {
          event: 'model-call-finish',
          callId,
          ...(attempt.stepNumber !== undefined ? { stepNumber: attempt.stepNumber } : {}),
          provider: stringField(raw?.provider),
          modelId: stringField(raw?.modelId),
          durationMs: startedAt !== undefined ? timestamp() - startedAt : undefined,
          usage: normalizeTelemetryUsage(raw?.usage)
        },
        event
      )
    },
    onToolExecutionStart(event) {
      const raw = recordField(event)
      const toolCall = recordField(raw?.toolCall)
      const toolCallId = stringField(toolCall?.toolCallId)
      if (toolCallId) toolStartedAt.set(toolCallId, timestamp())
      emit(
        {
          event: 'tool-start',
          callId: stringField(raw?.callId),
          tool: {
            name: stringField(toolCall?.toolName),
            callId: toolCallId
          }
        },
        event
      )
    },
    onToolExecutionEnd(event) {
      const raw = recordField(event)
      const toolCall = recordField(raw?.toolCall)
      const toolOutput = recordField(raw?.toolOutput)
      const toolCallId = stringField(toolCall?.toolCallId)
      const success = stringField(toolOutput?.type) !== 'tool-error'
      const durationMs =
        numberField(raw?.durationMs) ??
        (toolCallId && toolStartedAt.has(toolCallId)
          ? timestamp() - (toolStartedAt.get(toolCallId) as number)
          : undefined)
      emit(
        {
          event: 'tool-finish',
          callId: stringField(raw?.callId),
          durationMs,
          tool: {
            name: stringField(toolCall?.toolName),
            callId: toolCallId,
            success,
            durationMs
          },
          ...(success
            ? {}
            : {
                error: normalizeTelemetryError(
                  (toolOutput as { error?: unknown } | undefined)?.error
                )
              })
        },
        event
      )
    },
    onStepEnd(event) {
      const raw = recordField(event)
      const stepNumber = numberField(raw?.stepNumber)
      const startedAt = stepNumber !== undefined ? stepStartedAt.get(stepNumber) : undefined
      emit(
        {
          event: 'step-finish',
          ...(stepNumber !== undefined ? { stepNumber } : {}),
          durationMs: startedAt !== undefined ? timestamp() - startedAt : undefined,
          usage: normalizeTelemetryUsage(raw?.usage)
        },
        event
      )
    },
    onEnd(event) {
      const raw = recordField(event)
      flushChunkSummary()
      emit(
        {
          event: operationEventName('finish', stringField(raw?.operationId)),
          operationId: stringField(raw?.operationId),
          callId: stringField(raw?.callId),
          provider: stringField(raw?.provider),
          modelId: stringField(raw?.modelId),
          durationMs:
            operationStartedAt !== undefined ? timestamp() - operationStartedAt : undefined,
          usage: normalizeTelemetryUsage(raw?.totalUsage ?? raw?.usage)
        },
        event
      )
    },
    onEmbedStart(event) {
      emitRaw('embed-call-start', event)
    },
    onEmbedEnd(event) {
      emitRaw('embed-call-finish', event)
    },
    onRerankStart(event) {
      emitRaw('rerank-call-start', event)
    },
    onRerankEnd(event) {
      emitRaw('rerank-call-finish', event)
    },
    onError(event) {
      const raw = recordField(event)
      const error = raw && 'error' in raw ? raw.error : event
      emitError(error, event)
    },
    executeTool(options) {
      emitRaw('tool-context-start', options)
      return options.execute()
    }
  }

  return {
    runId: input.runId,
    options: {
      isEnabled: true,
      recordInputs: input.recordInputs ?? true,
      recordOutputs: input.recordOutputs ?? true,
      functionId: input.functionId ?? `tanzo.agent.${input.scope}`,
      integrations: [integration]
    },
    emit,
    emitError,
    emitRaw,
    flushChunkSummary
  }
}

export { normalizeTelemetryError, retryTelemetryFromError } from './errors'
export type { AgentTelemetryEvent, AgentTelemetrySink } from './events'
