import { useMemo } from 'react'
import type { McpServerConfig } from '@/common/contracts'
import { includesQuery, normalizeQuery } from '@/common/lib/filter-utils'

export type McpPageFilters = {
  status?: 'enabled' | 'disabled'
  transport?: 'stdio' | 'sse' | 'http'
}

export function useMcpPageFilters(params: {
  servers: McpServerConfig[]
  searchQuery: string
  filters: McpPageFilters
}) {
  const { servers, searchQuery, filters } = params

  return useMemo(() => {
    const query = normalizeQuery(searchQuery)
    let filteredServers = servers

    if (query) {
      filteredServers = filteredServers.filter((server) => {
        return (
          includesQuery(server.name, query) ||
          includesQuery(server.description, query) ||
          includesQuery(server.command, query) ||
          includesQuery(server.url, query)
        )
      })
    }

    if (filters.status === 'enabled') {
      filteredServers = filteredServers.filter((server) => server.enabled)
    } else if (filters.status === 'disabled') {
      filteredServers = filteredServers.filter((server) => !server.enabled)
    }

    if (filters.transport) {
      filteredServers = filteredServers.filter((server) => server.transport === filters.transport)
    }

    const enabledServers: McpServerConfig[] = []
    const disabledServers: McpServerConfig[] = []
    for (const server of filteredServers) {
      if (server.enabled) {
        enabledServers.push(server)
      } else {
        disabledServers.push(server)
      }
    }

    return {
      filteredServers,
      enabledServers,
      disabledServers,
      enabledCount: servers.filter((server) => server.enabled).length
    }
  }, [filters.status, filters.transport, searchQuery, servers])
}
