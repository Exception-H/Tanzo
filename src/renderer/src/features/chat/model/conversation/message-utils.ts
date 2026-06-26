import type { TanzoDataParts, TanzoUIMessage } from '@shared/agent-message'

export function latestCompaction(
  messages: readonly TanzoUIMessage[]
): TanzoDataParts['compaction'] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    for (let j = message.parts.length - 1; j >= 0; j--) {
      const part = message.parts[j]
      if (part.type === 'data-compaction') return part.data
    }
  }
  return null
}

export function upsertMessage(
  messages: readonly TanzoUIMessage[],
  message: TanzoUIMessage
): TanzoUIMessage[] {
  const idx = messages.findIndex((item) => item.id === message.id)
  if (idx === -1) return [...messages, message]
  const next = messages.slice()
  next[idx] = message
  return next
}
