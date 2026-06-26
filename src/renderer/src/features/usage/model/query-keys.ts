import type { ActivityRange, ActivityRunPage } from '@shared/activity'

export const usageKeys = {
  all: ['usage'] as const,
  summary: (range: ActivityRange) => [...usageKeys.all, 'summary', range.from, range.to] as const,
  trend: (range: ActivityRange) => [...usageKeys.all, 'trend', range.from, range.to] as const,
  conversations: (range: ActivityRange, page: ActivityRunPage) =>
    [...usageKeys.all, 'conversations', range.from, range.to, page.limit, page.offset] as const,
  runDetail: (runId: string) => [...usageKeys.all, 'run-detail', runId] as const
}
