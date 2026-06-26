import type { ModelMessage, SystemModelMessage } from 'ai'
import type { CompiledContext } from '../section'
import type { ProviderContextStrategy } from './strategy'

type Ttl = '5m' | '1h'

function withCacheControl<T extends { providerOptions?: Record<string, unknown> }>(
  message: T,
  ttl: Ttl
): T {
  const prev = message.providerOptions ?? {}
  const prevAnthropic = (prev.anthropic as Record<string, unknown> | undefined) ?? {}
  return {
    ...message,
    providerOptions: {
      ...prev,
      anthropic: { ...prevAnthropic, cacheControl: { type: 'ephemeral', ttl } }
    }
  }
}

function markStableBoundary(system: SystemModelMessage[], boundary: number): SystemModelMessage[] {
  if (boundary <= 0 || boundary > system.length) return system
  const index = boundary - 1
  return system.map((message, i) => (i === index ? withCacheControl(message, '1h') : message))
}

function markTail(messages: ModelMessage[], count: number, ttl: Ttl): ModelMessage[] {
  if (messages.length === 0 || count <= 0) return messages
  const firstMarked = Math.max(messages.length - count, 0)
  return messages.map((message, i) => (i >= firstMarked ? withCacheControl(message, ttl) : message))
}

function markStableLeadingBoundary(leadingUser: ModelMessage[]): ModelMessage[] {
  return markTail(leadingUser, 1, '1h')
}

function markHistoryTail(history: ModelMessage[]): ModelMessage[] {
  if (history.length === 0) return history
  return markTail(history, 2, '5m')
}

export function createAnthropicStrategy(): ProviderContextStrategy {
  return {
    cacheKind: 'ephemeral',
    applyCaching(plan): CompiledContext {
      return {
        ...plan,
        system: markStableBoundary(plan.system, plan.stableBoundary),
        leadingUser: markStableLeadingBoundary(plan.leadingUser),
        history: markHistoryTail(plan.history)
      }
    }
  }
}
