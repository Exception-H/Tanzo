import { CollapsibleGrid } from '@/components/ui/collapsible-grid'
import type { ProviderConfig, ProviderId, ProviderSetupState } from '@/common/contracts'
import { ProviderCard } from './provider-card'

interface ProvidersGridProps {
  title: string
  providers: ProviderConfig[]
  setupByProviderId: Record<string, ProviderSetupState | undefined>
  defaultOpen?: boolean
  onProviderClick?: (providerId: ProviderId) => void
}

export function ProvidersGrid({
  title,
  providers,
  setupByProviderId,
  defaultOpen = true,
  onProviderClick
}: ProvidersGridProps) {
  return (
    <CollapsibleGrid
      title={title}
      items={providers}
      getItemKey={(provider) => provider.id}
      defaultOpen={defaultOpen}
      renderItem={(provider) => (
        <ProviderCard
          provider={provider}
          setup={setupByProviderId[provider.id]}
          onClick={onProviderClick}
        />
      )}
    />
  )
}
