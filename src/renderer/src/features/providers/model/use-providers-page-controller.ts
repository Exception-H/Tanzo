import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveFilters, FilterGroup } from '@/components/layout/page-scaffold'
import type { ModelFamily, ProviderSetupState } from '@/common/contracts'
import { useProviderCatalog, useProviderSetups } from './queries'
import { useProviderDetailStore, useProviderListStore } from './store'
import { useProvidersPageFilters, type ProvidersPageFilters } from './use-providers-page-filters'

const FAMILY_FILTERS: ModelFamily[] = ['language', 'embedding', 'image', 'transcription', 'speech']
const EMPTY_SETUPS: ProviderSetupState[] = []

export function useProvidersPageController() {
  const { t } = useTranslation()
  const searchQuery = useProviderListStore((state) => state.searchQuery)
  const setSearchQuery = useProviderListStore((state) => state.setSearchQuery)
  const filters = useProviderListStore((state) => state.filters)
  const setFilter = useProviderListStore((state) => state.setFilter)
  const selectedProviderId = useProviderDetailStore((state) => state.selectedProviderId)
  const setSelectedProviderId = useProviderDetailStore((state) => state.setSelectedProviderId)
  const catalogQuery = useProviderCatalog()
  const setupsQuery = useProviderSetups()
  const providers = catalogQuery.data ?? []
  const setups = setupsQuery.data ?? EMPTY_SETUPS
  const activeFilters: ActiveFilters & ProvidersPageFilters = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.family ? { family: filters.family } : {})
  }
  const setupByProviderId = useMemo<Record<string, ProviderSetupState | undefined>>(
    () => Object.fromEntries(setups.map((setup) => [setup.providerId, setup])),
    [setups]
  )
  const filterGroups: FilterGroup[] = [
    {
      key: 'status',
      label: t('providers.page.filters.status.label'),
      options: [
        { value: 'configured', label: t('common.status.configured') },
        { value: 'available', label: t('common.status.notConfigured') }
      ]
    },
    {
      key: 'family',
      label: t('providers.page.filters.family.label'),
      options: FAMILY_FILTERS.map((family) => ({
        value: family,
        label: t(`providers.family.labels.${family}`)
      }))
    }
  ]
  const groups = useProvidersPageFilters({
    providers,
    setupByProviderId,
    searchQuery,
    filters: activeFilters
  })

  function handleFilterChange(key: string, value: string | undefined) {
    setFilter(key as keyof typeof filters, value)
  }

  return {
    searchQuery,
    setSearchQuery,
    activeFilters,
    filterGroups,
    selectedProviderId,
    setSelectedProviderId,
    setupByProviderId,
    providers,
    setups,
    error: catalogQuery.error ?? setupsQuery.error,
    isError: catalogQuery.isError || setupsQuery.isError,
    isInitialLoading:
      (catalogQuery.isPending && !catalogQuery.data) ||
      (setupsQuery.isPending && !setupsQuery.data),
    handleFilterChange,
    ...groups
  }
}
