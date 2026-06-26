import { ACTIVITY_CHANNELS } from '@shared/activity'
import { activityRangeSchema, activityRunPageSchema, chatIdSchema } from './schemas'
import type { AgentIpcDeps, IpcRegistration } from './types'

export function activityHandlers(deps: AgentIpcDeps): IpcRegistration[] {
  return [
    [
      ACTIVITY_CHANNELS.summary,
      (range) => deps.store.getActivitySummary(activityRangeSchema.parse(range))
    ],
    [
      ACTIVITY_CHANNELS.trend,
      (range) => deps.store.getActivityTrend(activityRangeSchema.parse(range))
    ],
    [
      ACTIVITY_CHANNELS.reliability,
      (range) => deps.store.getActivityReliability(activityRangeSchema.parse(range))
    ],
    [
      ACTIVITY_CHANNELS.conversations,
      (range, page) =>
        deps.store.listActivityConversations(
          activityRangeSchema.parse(range),
          activityRunPageSchema.parse(page)
        )
    ],
    [
      ACTIVITY_CHANNELS.runs,
      (range, page) =>
        deps.store.listActivityRuns(
          activityRangeSchema.parse(range),
          activityRunPageSchema.parse(page)
        )
    ],
    [
      ACTIVITY_CHANNELS.runDetail,
      (runId) => deps.store.getActivityRunDetail(chatIdSchema.parse(runId))
    ]
  ]
}
