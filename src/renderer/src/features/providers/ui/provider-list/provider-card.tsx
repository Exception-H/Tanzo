import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CardDescription,
  CardDivider,
  CardFooter,
  CardHeader,
  CardStatusBadge,
  FeatureCard
} from '@/components/ui/feature-card'
import type { ProviderConfig, ProviderId, ProviderSetupState } from '@/common/contracts'
import { isReadyProvider, providerStatusLabel } from '../../lib/provider-utils'

interface ProviderCardProps {
  provider: ProviderConfig
  setup?: ProviderSetupState
  onClick?: (providerId: ProviderId) => void
}

export function ProviderCard({ provider, setup, onClick }: ProviderCardProps) {
  const { t } = useTranslation()
  const ready = isReadyProvider(setup)
  const status =
    setup?.connection.status === 'expired'
      ? t('providers.status.expired')
      : t(providerStatusLabel(setup?.configurationStatus ?? 'not_connected'))

  return (
    <FeatureCard onClick={() => onClick?.(provider.id)}>
      <div className="flex-1">
        <CardHeader title={provider.name}>
          <CardDescription>{provider.description}</CardDescription>
        </CardHeader>
      </div>

      <CardDivider />

      <CardFooter>
        <CardStatusBadge
          active={ready}
          activeIcon={<CheckCircle2 className="size-3 text-background" />}
          activeText={status}
          inactiveText={status}
        />
      </CardFooter>
    </FeatureCard>
  )
}
