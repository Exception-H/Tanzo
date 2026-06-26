import { useEffect, useSyncExternalStore } from 'react'
import { getChatSession, type ChatSession, type ChatSessionState } from './chat-session'

export function useChatSession(chatId: string): {
  session: ChatSession
  state: ChatSessionState
} {
  const session = getChatSession(chatId)
  useEffect(() => session.retain(), [session])
  const state = useSyncExternalStore(session.subscribe, session.getState)
  return { session, state }
}
