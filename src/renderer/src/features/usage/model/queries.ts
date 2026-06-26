import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ActivityRange, ActivityRunPage } from '@shared/activity'
import { activityClient } from '@/platform/electron/activity-client'
import { usageKeys } from './query-keys'

const USAGE_STALE_TIME = 30_000
const USAGE_GC_TIME = 30 * 60 * 1_000

export function useUsageSummary(range: ActivityRange) {
  return useQuery({
    queryKey: usageKeys.summary(range),
    queryFn: () => activityClient.summary(range),
    placeholderData: keepPreviousData,
    staleTime: USAGE_STALE_TIME,
    gcTime: USAGE_GC_TIME
  })
}

export function useUsageTrend(range: ActivityRange) {
  return useQuery({
    queryKey: usageKeys.trend(range),
    queryFn: () => activityClient.trend(range),
    placeholderData: keepPreviousData,
    staleTime: USAGE_STALE_TIME,
    gcTime: USAGE_GC_TIME
  })
}

export function useUsageConversations(range: ActivityRange, page: ActivityRunPage) {
  return useQuery({
    queryKey: usageKeys.conversations(range, page),
    queryFn: () => activityClient.conversations(range, page),
    placeholderData: keepPreviousData,
    staleTime: USAGE_STALE_TIME,
    gcTime: USAGE_GC_TIME
  })
}

export function useUsageRunDetail(runId: string | null) {
  return useQuery({
    queryKey: usageKeys.runDetail(runId ?? ''),
    queryFn: () => activityClient.runDetail(runId as string),
    enabled: runId !== null,
    staleTime: USAGE_STALE_TIME,
    gcTime: USAGE_GC_TIME
  })
}
