import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createListUiStore } from '@/common/lib/create-list-ui-store'
import type { ModelFamily, ProviderId } from '@/common/contracts'

type ProviderFilters = {
  status?: 'configured' | 'available'
  family?: ModelFamily
}

export const useProviderListStore = createListUiStore<ProviderFilters>('provider-list-store', {})

interface ProviderDetailStore {
  selectedProviderId: ProviderId | null
  activeTab: 'api' | `family:${ModelFamily}`
  setSelectedProviderId: (providerId: ProviderId | null) => void
  setActiveTab: (tab: ProviderDetailStore['activeTab']) => void
}

export const useProviderDetailStore = create<ProviderDetailStore>()(
  devtools(
    (set) => ({
      selectedProviderId: null,
      activeTab: 'api',
      setSelectedProviderId: (providerId) =>
        set((state) =>
          state.selectedProviderId === providerId ? state : { selectedProviderId: providerId }
        ),
      setActiveTab: (activeTab) =>
        set((state) => (state.activeTab === activeTab ? state : { activeTab }))
    }),
    { name: 'provider-detail-store' }
  )
)
