import { Plug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'
import { ListPageScaffold } from '@/components/layout/page-scaffold'
import type { useProvidersPageController } from '../model/use-providers-page-controller'
import { ProviderDetailView } from './provider-detail/provider-detail-view'
import { ProvidersGrid } from './provider-list/providers-grid'

type ProvidersPageController = ReturnType<typeof useProvidersPageController>

export function ProvidersPageView({ controller }: { controller: ProvidersPageController }) {
  const { t } = useTranslation()

  if (controller.selectedProviderId) {
    return <ProviderDetailView providerId={controller.selectedProviderId} />
  }

  return (
    <ListPageScaffold
      title={t('providers.page.title')}
      stats={[
        { value: controller.providers.length, label: t('common.metrics.total') },
        ...(controller.configuredProviders.length > 0
          ? [
              {
                value: controller.configuredProviders.length,
                label: t('common.status.configured')
              }
            ]
          : [])
      ]}
      searchValue={controller.searchQuery}
      onSearchChange={controller.setSearchQuery}
      searchPlaceholder={t('providers.page.search.placeholder')}
      filters={controller.filterGroups}
      activeFilters={controller.activeFilters}
      onFilterChange={controller.handleFilterChange}
    >
      {controller.isInitialLoading ? null : controller.isError ? (
        <EmptyState
          icon={Plug}
          title={t('providers.page.errors.loadFailedTitle')}
          description={controller.error?.message ?? t('providers.page.errors.loadFailed')}
          className="h-full flex-1"
        />
      ) : controller.filteredProviders.length > 0 ? (
        <div className="space-y-8">
          {controller.configuredProviders.length > 0 ? (
            <ProvidersGrid
              title={t('common.status.configured')}
              providers={controller.configuredProviders}
              setupByProviderId={controller.setupByProviderId}
              onProviderClick={controller.setSelectedProviderId}
            />
          ) : null}
          {controller.notConfiguredProviders.length > 0 ? (
            <ProvidersGrid
              title={t('providers.page.sections.available.title')}
              providers={controller.notConfiguredProviders}
              setupByProviderId={controller.setupByProviderId}
              defaultOpen={controller.configuredProviders.length === 0}
              onProviderClick={controller.setSelectedProviderId}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={Plug}
          title={t('providers.page.empty.title')}
          description={t('providers.page.empty.description')}
          className="h-full flex-1"
          searchQuery={controller.searchQuery}
        />
      )}
    </ListPageScaffold>
  )
}
