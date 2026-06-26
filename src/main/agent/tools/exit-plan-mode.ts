import { tool, zodSchema, type Tool } from 'ai'
import type { ToolResultOutput } from '@ai-sdk/provider-utils'
import type { TanzoTools } from '@shared/agent-message'
import { isStructuredToolError } from './model-output'
import { exitPlanModeInputSchema } from './tool-schemas'

const DESC =
  'Present a finished implementation plan and request approval to leave plan mode and start ' +
  'coding. Only call this in plan mode, after you have finished read-only research. Pass the ' +
  'complete plan as markdown (context, files to change, functions to reuse, and verification ' +
  'steps). The user reviews the plan and either approves execution or rejects with feedback. ' +
  'Do not ask for plan approval in plain text — always use this tool.'

const APPROVED_MESSAGE =
  'The user approved the plan and plan mode is now off. Begin implementing the approved plan now ' +
  'in this turn: make the actual file edits and run the commands the plan calls for — do not stop ' +
  'to re-summarize or ask whether to proceed. Follow the plan, re-reading files as needed, and ' +
  'carry the work through implementation and verification.'

function exitPlanModeOutput({
  output
}: {
  output: TanzoTools['exitPlanMode']['output']
}): ToolResultOutput {
  if (isStructuredToolError(output)) return { type: 'error-text', value: output.message }
  return { type: 'text', value: output.message }
}

export function exitPlanModeTool(): Tool<
  TanzoTools['exitPlanMode']['input'],
  TanzoTools['exitPlanMode']['output']
> {
  return tool<
    TanzoTools['exitPlanMode']['input'],
    TanzoTools['exitPlanMode']['output'],
    Record<string, unknown>
  >({
    description: DESC,
    inputSchema: zodSchema(exitPlanModeInputSchema),
    metadata: { tanzo: { component: 'PlanReviewCard' } },
    toModelOutput: exitPlanModeOutput,
    async execute() {
      return { acknowledged: true, message: APPROVED_MESSAGE }
    }
  }) as Tool<TanzoTools['exitPlanMode']['input'], TanzoTools['exitPlanMode']['output']>
}
