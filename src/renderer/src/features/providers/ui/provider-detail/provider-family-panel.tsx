import { useTranslation } from 'react-i18next'
import type { ModelFamily, ProviderId, ProviderWorkspace } from '@/common/contracts'
import { ModelsList } from '../model/models-list'
import { DefaultsPanel } from './defaults-panel'

interface ProviderFamilyPanelProps {
  providerId: ProviderId
  family: ModelFamily
  workspace: ProviderWorkspace
}

export function ProviderFamilyPanel({ providerId, family, workspace }: ProviderFamilyPanelProps) {
  const { t } = useTranslation()
  const familyState = workspace.modalities[family]

  if (!familyState) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-[var(--radius-2xl)] border border-border/50 bg-background/95 px-4 py-8 text-center text-[0.75rem] text-muted-foreground shadow-sm">
        {t('providers.family.unavailable', { family: t(`providers.family.labels.${family}`) })}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModelsList providerId={providerId} family={family} state={familyState} />
      <DefaultsPanel providerId={providerId} family={family} defaults={familyState.defaults} />
    </div>
  )
}
