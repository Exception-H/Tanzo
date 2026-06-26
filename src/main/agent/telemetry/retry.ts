import { recordField, stringField, numberField } from './events'
import type { AgentTelemetryRetry } from './events'

interface StepContext {
  callId?: string
  stepNumber?: number
  provider?: string
  modelId?: string
  maxRetries?: number
}

export interface RetryAttemptInfo {
  attempt: number
  stepNumber?: number
  maxRetries?: number
  retry?: AgentTelemetryRetry
}

export function createRetryTracker(): {
  startOperation(raw: unknown): void
  startStep(raw: unknown): void
  startModelCall(raw: unknown): RetryAttemptInfo
  currentModelCall(raw: unknown): RetryAttemptInfo
} {
  let currentStep: StepContext | undefined
  let maxRetries: number | undefined
  const attemptsByStep = new Map<string, number>()

  function key(callId: string | undefined, stepNumber: number | undefined): string {
    return `${callId ?? 'unknown'}:${stepNumber ?? 'unknown'}`
  }

  return {
    startOperation(raw) {
      const event = recordField(raw)
      maxRetries = numberField(event?.maxRetries)
    },
    startStep(raw) {
      const event = recordField(raw)
      currentStep = {
        callId: stringField(event?.callId),
        stepNumber: numberField(event?.stepNumber),
        provider: stringField(event?.provider),
        modelId: stringField(event?.modelId),
        maxRetries
      }
    },
    startModelCall(raw) {
      const event = recordField(raw)
      const callId = stringField(event?.callId) ?? currentStep?.callId
      const stepNumber = currentStep?.stepNumber
      const stepKey = key(callId, stepNumber)
      const attempt = (attemptsByStep.get(stepKey) ?? 0) + 1
      attemptsByStep.set(stepKey, attempt)
      return {
        attempt,
        ...(stepNumber !== undefined ? { stepNumber } : {}),
        ...(currentStep?.maxRetries !== undefined ? { maxRetries: currentStep.maxRetries } : {}),
        ...(attempt > 1
          ? {
              retry: {
                attempt,
                ...(currentStep?.maxRetries !== undefined
                  ? { maxRetries: currentStep.maxRetries }
                  : {})
              }
            }
          : {})
      }
    },
    currentModelCall(raw) {
      const event = recordField(raw)
      const callId = stringField(event?.callId) ?? currentStep?.callId
      const stepNumber = currentStep?.stepNumber
      const stepKey = key(callId, stepNumber)
      const attempt = attemptsByStep.get(stepKey) ?? 1
      return {
        attempt,
        ...(stepNumber !== undefined ? { stepNumber } : {}),
        ...(currentStep?.maxRetries !== undefined ? { maxRetries: currentStep.maxRetries } : {})
      }
    }
  }
}
