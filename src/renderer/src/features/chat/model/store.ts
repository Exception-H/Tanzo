import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ChatUiState {
  activeChatId: string | null
  draftByChatId: Record<string, string>
  disclosureById: Record<string, boolean>
}

interface ChatUiActions {
  setActiveChatId: (chatId: string | null) => void
  setDraft: (chatId: string, draft: string) => void
  setDisclosure: (id: string, open: boolean) => void
}

type ChatUiStore = ChatUiState & ChatUiActions

export const useChatUiStore = create<ChatUiStore>()(
  devtools(
    (set) => ({
      activeChatId: null,
      draftByChatId: {},
      disclosureById: {},
      setActiveChatId: (chatId) =>
        set((state) => (state.activeChatId === chatId ? state : { activeChatId: chatId })),
      setDraft: (chatId, draft) =>
        set((state) => {
          if (state.draftByChatId[chatId] === draft) return state
          const next = { ...state.draftByChatId }
          if (draft) next[chatId] = draft
          else delete next[chatId]
          return { draftByChatId: next }
        }),
      setDisclosure: (id, open) =>
        set((state) => {
          if (state.disclosureById[id] === open) return state
          return { disclosureById: { ...state.disclosureById, [id]: open } }
        })
    }),
    { name: 'chat-ui-store' }
  )
)
