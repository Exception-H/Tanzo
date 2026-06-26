import { CollapsibleGrid } from '@/components/ui/collapsible-grid'
import { ServerCard } from './server-card'
import type { McpServerConfig } from '@/common/contracts'

interface ServersGridProps {
  title: string
  servers: McpServerConfig[]
  defaultOpen?: boolean
  onServerClick?: (serverId: string) => void
}

export function ServersGrid({
  title,
  servers,
  defaultOpen = true,
  onServerClick
}: ServersGridProps) {
  return (
    <CollapsibleGrid
      title={title}
      items={servers}
      getItemKey={(server) => server.id || server.name}
      defaultOpen={defaultOpen}
      renderItem={(server) => <ServerCard server={server} onClick={onServerClick} />}
    />
  )
}
