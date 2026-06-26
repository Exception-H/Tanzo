import { useTranslation } from 'react-i18next'
import type { ActiveFilters, FilterGroup } from '@/components/layout/page-scaffold'
import { useMcpDetailStore, useMcpListStore } from './store'
import { useServers } from './queries'
import { useMcpPageFilters, type McpPageFilters } from './use-mcp-page-filters'

export function useMcpPageController() {
  const { t } = useTranslation()
  const searchQuery = useMcpListStore((s) => s.searchQuery)
  const setSearchQuery = useMcpListStore((s) => s.setSearchQuery)
  const filters = useMcpListStore((s) => s.filters)
  const setFilter = useMcpListStore((s) => s.setFilter)
  const selectedServerId = useMcpDetailStore((s) => s.selectedServerId)
  const setSelectedServerId = useMcpDetailStore((s) => s.setSelectedServerId)
  const activeFilters: ActiveFilters & McpPageFilters = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.transport ? { transport: filters.transport } : {})
  }
  const filterGroups: FilterGroup[] = [
    {
      key: 'status',
      label: t('mcp.page.filters.status.label'),
      options: [
        { value: 'enabled', label: t('common.status.enabled') },
        { value: 'disabled', label: t('common.status.disabled') }
      ]
    },
    {
      key: 'transport',
      label: t('mcp.page.filters.transport.label'),
      options: [
        { value: 'stdio', label: t('mcp.transport.stdio') },
        { value: 'sse', label: t('mcp.transport.sse') },
        { value: 'http', label: t('mcp.transport.http') }
      ]
    }
  ]
  const { data: servers, isPending } = useServers()
  const resolvedServers = servers ?? []
  const isInitialLoading = isPending && !servers
  const filtered = useMcpPageFilters({
    servers: resolvedServers,
    searchQuery,
    filters: activeFilters
  })
  const selectedServer = selectedServerId
    ? (resolvedServers.find((server) => server.id === selectedServerId) ?? null)
    : null

  function handleFilterChange(key: string, value: string | undefined) {
    setFilter(key as keyof typeof filters, value)
  }

  return {
    searchQuery,
    setSearchQuery,
    activeFilters,
    filterGroups,
    resolvedServers,
    isInitialLoading,
    selectedServer,
    setSelectedServerId,
    handleFilterChange,
    ...filtered
  }
}
