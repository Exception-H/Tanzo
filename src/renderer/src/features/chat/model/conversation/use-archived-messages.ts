import type { TanzoUIMessage } from '@shared/agent-message'
import type { ChatSession, ChatSessionState } from './chat-session'

export function useArchivedMessages(
  _session: ChatSession,
  state: ChatSessionState
): TanzoUIMessage[] {
  return state.messages
}
