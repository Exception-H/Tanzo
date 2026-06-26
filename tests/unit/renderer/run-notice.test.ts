import { describe, expect, it } from 'vitest'
import type { TanzoDataParts } from '@shared/agent-message'
import {
  reduceRunNotice,
  type RunNotice
} from '@renderer/features/chat/model/conversation/use-run-notice'

function telemetry(
  event: Partial<TanzoDataParts['telemetry']> & Pick<TanzoDataParts['telemetry'], 'event'>
): TanzoDataParts['telemetry'] {
  return {
    runId: 'run-1',
    scope: 'chat',
    sequence: 1,
    timestamp: 1,
    ...event
  } as TanzoDataParts['telemetry']
}

describe('chat/use-run-notice reduceRunNotice', () => {
  it('shows retry attempts with the user-facing retry number', () => {
    expect(
      reduceRunNotice(
        null,
        telemetry({
          event: 'retry-attempt',
          retry: { attempt: 2, maxRetries: 3 }
        })
      )
    ).toEqual({ kind: 'retry', retryNumber: 1, maxRetries: 3 })
  })

  it('clears retry notice when output resumes', () => {
    const retryNotice: RunNotice = { kind: 'retry', retryNumber: 1 }

    expect(
      reduceRunNotice(retryNotice, telemetry({ event: 'chunk-summary', chunks: { count: 1 } }))
    ).toBeNull()
  })

  it('replaces retry notice with terminal retry errors', () => {
    const retryNotice: RunNotice = { kind: 'retry', retryNumber: 3 }
    const error: NonNullable<TanzoDataParts['telemetry']['error']> = {
      kind: 'retry',
      message: 'Retries exhausted',
      reason: 'maxRetriesExceeded'
    }

    expect(
      reduceRunNotice(
        retryNotice,
        telemetry({ event: 'retry-exhausted', retry: { attempt: 4 }, error })
      )
    ).toEqual({ kind: 'error', error })
  })
})
