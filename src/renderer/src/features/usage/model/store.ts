import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type UsageRangePreset = '24h' | '7d' | '30d' | 'all'

interface UsageListStore {
  preset: UsageRangePreset
  offset: number
  selectedRunId: string | null
  anchorNow: number
  changePreset: (preset: UsageRangePreset) => void
  setOffset: (offset: number) => void
  setSelectedRunId: (runId: string | null) => void
}

export const useUsageListStore = create<UsageListStore>()(
  devtools(
    (set) => ({
      preset: '24h',
      offset: 0,
      selectedRunId: null,
      anchorNow: Date.now(),
      changePreset: (preset) =>
        set({ preset, anchorNow: Date.now(), offset: 0, selectedRunId: null }),
      setOffset: (offset) => set((state) => (state.offset === offset ? state : { offset })),
      setSelectedRunId: (selectedRunId) =>
        set((state) => (state.selectedRunId === selectedRunId ? state : { selectedRunId }))
    }),
    { name: 'usage-list-store' }
  )
)
