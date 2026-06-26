import { useMemo } from 'react'
import type { ActiveFilters } from '@/components/layout/page-scaffold'
import type { ModelFamily, ProviderConfig, ProviderSetupState } from '@/common/contracts'
import { includesQuery, normalizeQuery } from '@/common/lib/filter-utils'
import { isConfiguredProvider, sortedFamilies } from '../lib/provider-utils'

export interface ProvidersPageFilters extends ActiveFilters {
  status?: 'configured' | 'available'
  family?: ModelFamily
}

interface UseProvidersPageFiltersInput {
  providers: ProviderConfig[]
  setupByProviderId: Record<string, ProviderSetupState | undefined>
  searchQuery: string
  filters: ProvidersPageFilters
}

export function useProvidersPageFilters({
  providers,
  setupByProviderId,
  searchQuery,
  filters
}: UseProvidersPageFiltersInput) {
  return useMemo(() => {
    const query = normalizeQuery(searchQuery)
    const filteredProviders = providers.filter((provider) => {
      if (
        query &&
        !includesQuery(provider.name, query) &&
        !includesQuery(provider.description, query) &&
        !includesQuery(provider.id, query)
      ) {
        return false
      }
      const setup = setupByProviderId[provider.id]
      const configured = isConfiguredProvider(setup)
      if (filters.status === 'configured' && !configured) return false
      if (filters.status === 'available' && configured) return false
      if (filters.family && !sortedFamilies(provider).includes(filters.family)) return false
      return true
    })
    const configuredProviders = filteredProviders.filter((provider) =>
      isConfiguredProvider(setupByProviderId[provider.id])
    )
    const notConfiguredProviders = filteredProviders.filter(
      (provider) => !isConfiguredProvider(setupByProviderId[provider.id])
    )

    return {
      filteredProviders,
      configuredProviders,
      notConfiguredProviders
    }
  }, [filters.family, filters.status, providers, searchQuery, setupByProviderId])
}
