import type { TanzoDataParts } from '@shared/agent-message'

export type RunNotice =
  | { kind: 'retry'; retryNumber: number; maxRetries?: number }
  | { kind: 'error'; error: NonNullable<TanzoDataParts['telemetry']['error']> }

function clearRetry(previous: RunNotice | null): RunNotice | null {
  return previous?.kind === 'retry' ? null : previous
}

export function reduceRunNotice(
  previous: RunNotice | null,
  event: TanzoDataParts['telemetry']
): RunNotice | null {
  switch (event.event) {
    case 'operation-start':
    case 'operation-finish':
    case 'model-call-finish':
    case 'step-finish':
    case 'tool-start':
    case 'tool-finish':
    case 'chunk-summary':
      return clearRetry(previous)
    case 'retry-attempt':
      if (!event.retry) return previous
      return {
        kind: 'retry',
        retryNumber: Math.max(event.retry.attempt - 1, 1),
        ...(event.retry.maxRetries !== undefined ? { maxRetries: event.retry.maxRetries } : {})
      }
    case 'retry-exhausted':
    case 'operation-error':
      return event.error ? { kind: 'error', error: event.error } : clearRetry(previous)
    default:
      return previous
  }
}
