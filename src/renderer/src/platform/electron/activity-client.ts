import type {
  ActivityApi,
  ActivityConversationList,
  ActivityRange,
  ActivityRunDetail,
  ActivityRunList,
  ActivityRunPage,
  ActivitySummary,
  ActivityTrend
} from '@shared/activity'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

export function requireActivityApi(): ActivityApi {
  const activityApi = window.electron?.activity
  if (!activityApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_ACTIVITY_API_UNAVAILABLE',
      'Electron activity API is not available'
    )
  }
  return withDecodedIpcErrors(activityApi)
}

export const activityClient = {
  summary(range: ActivityRange): Promise<ActivitySummary> {
    return requireActivityApi().summary(range)
  },
  trend(range: ActivityRange): Promise<ActivityTrend> {
    return requireActivityApi().trend(range)
  },
  conversations(range: ActivityRange, page: ActivityRunPage): Promise<ActivityConversationList> {
    return requireActivityApi().conversations(range, page)
  },
  runs(range: ActivityRange, page: ActivityRunPage): Promise<ActivityRunList> {
    return requireActivityApi().runs(range, page)
  },
  runDetail(runId: string): Promise<ActivityRunDetail> {
    return requireActivityApi().runDetail(runId)
  }
}
