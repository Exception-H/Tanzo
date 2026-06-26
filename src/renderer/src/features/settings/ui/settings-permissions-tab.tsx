import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'

export function SettingsPermissionsTab() {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={ShieldCheck}
      title={t('settings.permissions.empty', { defaultValue: 'No saved rules yet.' })}
      description={t('settings.permissions.emptyDescription', {
        defaultValue: 'Permission decisions saved from approval prompts will appear here.'
      })}
      className="min-h-full flex-1"
    />
  )
}
