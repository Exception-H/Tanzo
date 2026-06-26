import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { chatClient } from '@/platform/electron/chat-client'
import { chatKeys } from './query-keys'

const TERMINAL_RUN_STATUSES = new Set(['finished', 'failed', 'aborted'])

type RunningSet = ReadonlySet<string>

export function useRunningConversations(): RunningSet {
  const [runningChatIds, setRunningChatIds] = useState<Set<string>>(() => new Set())
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    const unsubscribe = chatClient.onAnyEvent((event) => {
      if (event.kind !== 'run-state') return
      if (TERMINAL_RUN_STATUSES.has(event.status)) {
        void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
      }
      setRunningChatIds((previous) => {
        const isRunning = event.status === 'running'
        if (!isRunning && !TERMINAL_RUN_STATUSES.has(event.status)) return previous
        if (previous.has(event.chatId) === isRunning) return previous
        const next = new Set(previous)
        if (isRunning) next.add(event.chatId)
        else next.delete(event.chatId)
        return next
      })
    })

    void chatClient
      .listRunning()
      .then((ids) => {
        if (!cancelled) setRunningChatIds(new Set(ids))
      })
      .catch(() => {})

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [queryClient])

  return runningChatIds
}
