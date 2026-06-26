export interface ChatMailbox {
  enqueue<T>(chatId: string, task: () => Promise<T> | T): Promise<T>
}

export function createChatMailbox(): ChatMailbox {
  const tails = new Map<string, Promise<unknown>>()

  return {
    enqueue(chatId, task) {
      const tail = tails.get(chatId) ?? Promise.resolve()
      const next = tail.then(
        () => task(),
        () => task()
      )
      const tracked = next.then(
        () => undefined,
        () => undefined
      )
      tails.set(chatId, tracked)
      void tracked.then(() => {
        if (tails.get(chatId) === tracked) tails.delete(chatId)
      })
      return next
    }
  }
}
