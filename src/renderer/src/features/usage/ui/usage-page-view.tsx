import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, CalendarClock, Clock3, History } from 'lucide-react'
import { ListPageScaffold } from '@/components/layout/page-scaffold'
import { PillTabsTrigger } from '@/components/layout/pill-tabs'
import { Tabs, TabsList } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { USAGE_RANGE_PRESETS, type UsagePageController, type UsageRangePreset } from '../model'
import { KpiCards } from './kpi-cards'
import { UsageTrendChart } from './usage-trend-chart'
import { ModelBreakdownTable } from './model-breakdown'
import { ConversationList } from './conversation-list'

interface UsagePageViewProps {
  controller: UsagePageController
}

function RangeTabs({ controller }: UsagePageViewProps): ReactNode {
  const { t } = useTranslation()
  return (
    <Tabs
      value={controller.preset}
      onValueChange={(value) => controller.changePreset(value as UsageRangePreset)}
    >
      <TabsList className="h-8 gap-0.5 rounded-full border border-border/25 bg-muted/25 p-1">
        {USAGE_RANGE_PRESETS.map((preset) => (
          <PillTabsTrigger key={preset} value={preset} className="h-6 px-3">
            <RangeIcon preset={preset} />
            {t(`usage.range.${preset}`)}
          </PillTabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function RangeIcon({ preset }: { preset: (typeof USAGE_RANGE_PRESETS)[number] }): ReactNode {
  const Icon = preset === '24h' ? Clock3 : preset === 'all' ? History : CalendarClock
  return <Icon className="size-3.5" aria-hidden="true" />
}

export function UsagePageView({ controller }: UsagePageViewProps): ReactNode {
  const { t } = useTranslation()
  const { summary, trend } = controller

  const hasModels = summary ? summary.models.length > 0 : false
  const hasTrend = trend ? trend.points.length > 0 : false

  return (
    <ListPageScaffold
      title={t('usage.page.title')}
      stats={[
        { value: controller.conversationsTotal, label: t('usage.stats.conversations') },
        ...(summary && summary.kpis.runCount > 0
          ? [{ value: summary.kpis.runCount, label: t('usage.stats.runs') }]
          : [])
      ]}
      actions={<RangeTabs controller={controller} />}
      contentClassName="px-0 pb-0"
    >
      {controller.isInitialLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : controller.isError ? (
        <EmptyState
          icon={BarChart3}
          title={t('usage.error.title')}
          description={t('usage.error.description')}
          className="h-full flex-1"
        />
      ) : summary && summary.kpis.runCount === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={t('usage.empty.title')}
          description={t('usage.empty.description')}
          className="h-full flex-1"
        />
      ) : summary ? (
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <KpiCards kpis={summary.kpis} />
            {hasTrend && trend ? (
              <div className="px-4 lg:px-6">
                <UsageTrendChart trend={trend} />
              </div>
            ) : null}
            <ConversationList controller={controller} />
            {hasModels ? (
              <div className="px-4 lg:px-6">
                <ModelBreakdownTable rows={summary.models} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </ListPageScaffold>
  )
}
