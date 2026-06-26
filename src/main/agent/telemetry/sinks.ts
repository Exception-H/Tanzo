import { randomUUID } from 'crypto'
import type { ChunkSink, Logger } from '../runtime/types'
import type { AgentStore } from '../store-types'
import type { AgentTelemetrySink, AgentTelemetrySinkRecord } from './events'

export function createUiTelemetrySink(input: {
  chatId: string
  send: ChunkSink
  enabled: boolean
}): AgentTelemetrySink {
  return {
    emit(record) {
      if (!input.enabled || !record.data) return
      input.send(
        input.chatId,
        {
          type: 'data-telemetry',
          id: randomUUID(),
          data: record.data,
          transient: true
        } as never,
        { runId: record.data.runId }
      )
    }
  }
}

export function createLoggerTelemetrySink(logger: Logger | undefined): AgentTelemetrySink {
  return {
    emit(record) {
      if (!logger || !record.data) return
      const payload = {
        event: record.data.event,
        runId: record.data.runId,
        chatId: record.data.chatId,
        scope: record.data.scope,
        sequence: record.data.sequence,
        provider: record.data.provider,
        modelId: record.data.modelId,
        callId: record.data.callId,
        stepNumber: record.data.stepNumber,
        durationMs: record.data.durationMs,
        retry: record.data.retry,
        error: record.data.error
      }
      if (record.data.error) logger.warn('agent telemetry event', payload)
      else logger.info('agent telemetry event', payload)
    }
  }
}

export function createMemoryTelemetrySink(target: AgentTelemetrySinkRecord[]): AgentTelemetrySink {
  return {
    emit(record) {
      target.push(record)
    }
  }
}

export function createDbTelemetrySink(input: {
  store: Pick<AgentStore, 'recordToolExecution'>
  logger?: Logger
}): AgentTelemetrySink {
  return {
    emit(record) {
      const data = record.data
      if (!data || data.event !== 'tool-finish') return
      if (data.scope !== 'chat' || !data.chatId) return
      try {
        input.store.recordToolExecution({
          id: randomUUID(),
          runId: `${data.chatId}:${data.runId}`,
          conversationId: data.chatId,
          toolName: data.tool?.name ?? 'unknown',
          ...(data.tool?.callId ? { toolCallId: data.tool.callId } : {}),
          success: data.tool?.success !== false,
          ...(typeof (data.tool?.durationMs ?? data.durationMs) === 'number'
            ? { durationMs: data.tool?.durationMs ?? data.durationMs }
            : {}),
          ...(data.error?.kind ? { errorKind: data.error.kind } : {}),
          ...(data.error?.message ? { errorMessage: data.error.message } : {}),
          createdAt: data.timestamp
        })
      } catch (error) {
        input.logger?.warn('tool execution telemetry persist failed', {
          chatId: data.chatId,
          runId: data.runId,
          tool: data.tool?.name,
          error
        })
      }
    }
  }
}

export function emitToSinks(
  sinks: AgentTelemetrySink[],
  record: AgentTelemetrySinkRecord,
  logger?: Logger
): void {
  for (const sink of sinks) {
    try {
      const result = sink.emit(record)
      if (result && typeof (result as Promise<void>).then === 'function') {
        void Promise.resolve(result).catch((error) => {
          logger?.warn('agent telemetry sink failed', { error })
        })
      }
    } catch (error) {
      logger?.warn('agent telemetry sink failed', { error })
    }
  }
}
