import { useMemo } from 'react'
import type { ActivityRange } from '@shared/activity'
import { useUsageConversations, useUsageRunDetail, useUsageSummary, useUsageTrend } from './queries'
import { useUsageListStore, type UsageRangePreset } from './store'

export type { UsageRangePreset }

const RANGE_DURATIONS_MS: Record<Exclude<UsageRangePreset, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1_000,
  '7d': 7 * 24 * 60 * 60 * 1_000,
  '30d': 30 * 24 * 60 * 60 * 1_000
}

export const USAGE_RANGE_PRESETS: readonly UsageRangePreset[] = ['24h', '7d', '30d', 'all']

const RUN_PAGE_SIZE = 8

function resolveRange(preset: UsageRangePreset, now: number): ActivityRange {
  if (preset === 'all') return { from: 0, to: now }
  return { from: now - RANGE_DURATIONS_MS[preset], to: now }
}

export function useUsagePageController() {
  const preset = useUsageListStore((state) => state.preset)
  const offset = useUsageListStore((state) => state.offset)
  const selectedRunId = useUsageListStore((state) => state.selectedRunId)
  const anchorNow = useUsageListStore((state) => state.anchorNow)
  const changePreset = useUsageListStore((state) => state.changePreset)
  const setOffset = useUsageListStore((state) => state.setOffset)
  const setSelectedRunId = useUsageListStore((state) => state.setSelectedRunId)

  const range = useMemo<ActivityRange>(() => resolveRange(preset, anchorNow), [preset, anchorNow])
  const page = useMemo(() => ({ limit: RUN_PAGE_SIZE, offset }), [offset])

  const summaryQuery = useUsageSummary(range)
  const trendQuery = useUsageTrend(range)
  const conversationsQuery = useUsageConversations(range, page)
  const runDetailQuery = useUsageRunDetail(selectedRunId)

  return {
    preset,
    changePreset,
    range,
    summary: summaryQuery.data,
    trend: trendQuery.data,
    conversations: conversationsQuery.data?.conversations ?? [],
    conversationsTotal: conversationsQuery.data?.total ?? 0,
    pageSize: RUN_PAGE_SIZE,
    offset,
    setOffset,
    selectedRunId,
    setSelectedRunId,
    runDetail: runDetailQuery.data,
    isRunDetailLoading: runDetailQuery.isPending && selectedRunId !== null,
    error: summaryQuery.error ?? conversationsQuery.error,
    isError: summaryQuery.isError || conversationsQuery.isError,
    isInitialLoading:
      (summaryQuery.isPending && !summaryQuery.data) ||
      (conversationsQuery.isPending && !conversationsQuery.data)
  }
}

export type UsagePageController = ReturnType<typeof useUsagePageController>
