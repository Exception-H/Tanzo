export interface ChatKeyedQueue<T> {
  push(chatId: string, item: T): void
  list(chatId: string): T[]
  drain(chatId: string): T[]
  shift(chatId: string): T | undefined
  removeAt(chatId: string, index: number): void
  clear(chatId: string): void
}

export function createChatKeyedQueue<T>(options?: {
  onChange?: (chatId: string, items: T[]) => void
}): ChatKeyedQueue<T> {
  const queues = new Map<string, T[]>()

  function notify(chatId: string): void {
    options?.onChange?.(chatId, [...(queues.get(chatId) ?? [])])
  }

  return {
    push(chatId, item) {
      const queue = queues.get(chatId)
      if (queue) queue.push(item)
      else queues.set(chatId, [item])
      notify(chatId)
    },
    list(chatId) {
      return [...(queues.get(chatId) ?? [])]
    },
    drain(chatId) {
      const queue = queues.get(chatId)
      if (!queue || queue.length === 0) return []
      queues.delete(chatId)
      notify(chatId)
      return queue
    },
    shift(chatId) {
      const queue = queues.get(chatId)
      if (!queue || queue.length === 0) return undefined
      const next = queue.shift()
      if (queue.length === 0) queues.delete(chatId)
      notify(chatId)
      return next
    },
    removeAt(chatId, index) {
      const queue = queues.get(chatId)
      if (!queue || index < 0 || index >= queue.length) return
      queue.splice(index, 1)
      if (queue.length === 0) queues.delete(chatId)
      notify(chatId)
    },
    clear(chatId) {
      if (!queues.delete(chatId)) return
      notify(chatId)
    }
  }
}
