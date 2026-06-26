import { tool, zodSchema, type Tool, type ToolSet } from 'ai'
import type { TanzoTools } from '@shared/agent-message'
import type { ToolDeps } from './types'
import { toolResultToModelOutput } from './model-output'
import { updateGoalInputSchema } from './tool-schemas'

const UPDATE_DESC =
  'Update the existing goal status. Use "complete" only when the objective is achieved and no required ' +
  'work remains, proven by current evidence. Use "blocked" only after the same blocker has repeated for ' +
  'at least three consecutive goal turns and you cannot make progress without user input or an external ' +
  'change. This tool cannot pause, resume, or budget-limit a goal.'

export function updateGoalTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['updateGoal']['input'], TanzoTools['updateGoal']['output']> {
  return tool<
    TanzoTools['updateGoal']['input'],
    TanzoTools['updateGoal']['output'],
    Record<string, unknown>
  >({
    description: UPDATE_DESC,
    inputSchema: zodSchema(updateGoalInputSchema),
    metadata: { tanzo: { kind: 'exec', component: 'GoalCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute({ status }) {
      const ok = deps.goal.markOutcome(chatId, status)
      if (!ok) return { error: true, message: 'No goal exists for this conversation.' }
      return { updated: true, status }
    }
  }) as Tool<TanzoTools['updateGoal']['input'], TanzoTools['updateGoal']['output']>
}

export function goalTools(deps: ToolDeps, chatId: string): ToolSet {
  return {
    updateGoal: updateGoalTool(deps, chatId)
  }
}
