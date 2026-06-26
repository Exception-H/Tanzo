import { createListUiStore } from '@/common/lib/create-list-ui-store'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

type McpFilters = {
  status?: 'enabled' | 'disabled'
  transport?: 'stdio' | 'sse' | 'http'
}

export const useMcpListStore = createListUiStore<McpFilters>('mcp-list-store', {})

interface McpDetailStore {
  selectedServerId: string | null
  setSelectedServerId: (id: string | null) => void
}

export const useMcpDetailStore = create<McpDetailStore>()(
  devtools(
    (set) => ({
      selectedServerId: null,
      setSelectedServerId: (id) =>
        set((state) => (state.selectedServerId === id ? state : { selectedServerId: id }))
    }),
    { name: 'mcp-detail-store' }
  )
)
