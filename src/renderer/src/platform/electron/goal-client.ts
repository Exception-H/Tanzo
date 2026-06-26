import type { CreateGoalInput, GoalApi, GoalUserStatusChange, ThreadGoal } from '@shared/goal'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

export function requireGoalApi(): GoalApi {
  const goalApi = window.electron?.goal
  if (!goalApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_GOAL_API_UNAVAILABLE',
      'Electron goal API is not available'
    )
  }
  return withDecodedIpcErrors(goalApi)
}

export const goalClient = {
  get(chatId: string): Promise<ThreadGoal | null> {
    return requireGoalApi().get(chatId)
  },
  create(chatId: string, input: CreateGoalInput): Promise<ThreadGoal> {
    return requireGoalApi().create(chatId, input)
  },
  updateObjective(chatId: string, objective: string): Promise<ThreadGoal> {
    return requireGoalApi().updateObjective(chatId, objective)
  },
  setStatus(chatId: string, status: GoalUserStatusChange): Promise<ThreadGoal> {
    return requireGoalApi().setStatus(chatId, status)
  },
  clear(chatId: string): Promise<void> {
    return requireGoalApi().clear(chatId)
  }
}
