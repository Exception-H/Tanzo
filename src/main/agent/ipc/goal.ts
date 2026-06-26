import { z } from 'zod'
import { GOAL_CHANNELS } from '@shared/goal'
import { chatIdSchema } from './schemas'
import type { AgentIpcDeps, IpcRegistration } from './types'

const goalCreateSchema = z.object({
  objective: z.string().trim().min(1),
  tokenBudget: z.number().int().positive().nullable().optional(),
  timeBudgetSeconds: z.number().int().positive().nullable().optional()
})

const goalObjectiveSchema = z.string().trim().min(1)

const goalStatusSchema = z.enum(['active', 'paused'])

export function goalHandlers(deps: AgentIpcDeps): IpcRegistration[] {
  function kick(chatId: string): void {
    void deps.service.startGoalContinuation(chatId)
  }

  return [
    [GOAL_CHANNELS.get, (chatId) => deps.goal.get(chatIdSchema.parse(chatId))],
    [
      GOAL_CHANNELS.create,
      (chatId, input) => {
        const id = chatIdSchema.parse(chatId)
        const goal = deps.goal.create(id, goalCreateSchema.parse(input))
        kick(id)
        return goal
      }
    ],
    [
      GOAL_CHANNELS.updateObjective,
      (chatId, objective) => {
        const id = chatIdSchema.parse(chatId)
        const goal = deps.goal.updateObjective(id, goalObjectiveSchema.parse(objective))
        kick(id)
        return goal
      }
    ],
    [
      GOAL_CHANNELS.setStatus,
      (chatId, status) => {
        const id = chatIdSchema.parse(chatId)
        const parsed = goalStatusSchema.parse(status)
        const goal = deps.goal.setUserState(id, parsed)
        if (parsed === 'active') kick(id)
        return goal
      }
    ],
    [GOAL_CHANNELS.clear, (chatId) => deps.goal.clear(chatIdSchema.parse(chatId))]
  ]
}
