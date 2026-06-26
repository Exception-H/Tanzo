export interface PendingHookContext {
  push(chatId: string, text: string): void
  drain(chatId: string): string[]
  clear(chatId: string): void
}

export function createPendingHookContext(): PendingHookContext {
  const buffers = new Map<string, string[]>()
  return {
    push(chatId, text) {
      const trimmed = text.trim()
      if (!trimmed) return
      const buffer = buffers.get(chatId)
      if (buffer) buffer.push(trimmed)
      else buffers.set(chatId, [trimmed])
    },
    drain(chatId) {
      const buffer = buffers.get(chatId)
      if (!buffer || buffer.length === 0) return []
      buffers.delete(chatId)
      return buffer
    },
    clear(chatId) {
      buffers.delete(chatId)
    }
  }
}
