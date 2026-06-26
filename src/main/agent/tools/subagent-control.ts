import { tool, zodSchema, type Tool, type ToolSet } from 'ai'
import type { TanzoTools } from '@shared/agent-message'
import type { ToolDeps } from './types'
import { toolResultToModelOutput } from './model-output'
import { toolError } from './builtin/shared'
import { reportInputSchema, reportOutputSchema } from './tool-schemas'

export function reportTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['report']['input'], TanzoTools['report']['output']> {
  return tool<
    TanzoTools['report']['input'],
    TanzoTools['report']['output'],
    Record<string, unknown>
  >({
    description:
      'Report progress to the parent. Pass phase to announce the step you are starting (call ' +
      'before each major phase). Pass result to submit your final, self-contained deliverable — ' +
      'that snapshot is what reaches the parent, so call it once you have the answer and then ' +
      'stop. You may pass both to report a phase and submit the result together.',
    inputSchema: zodSchema(reportInputSchema),
    outputSchema: zodSchema(reportOutputSchema),
    metadata: { tanzo: { kind: 'read', component: 'SubagentCard' } },
    toModelOutput: toolResultToModelOutput,
    execute({ phase, result }) {
      if (!phase && !result) return toolError('Provide a phase to report or a result to submit.')
      if (phase) deps.reportTaskPhase(chatId, phase)
      if (result) deps.submitTaskResult(chatId, { summary: result })
      return { ok: true }
    }
  })
}

export function subagentReportTools(deps: ToolDeps, chatId: string): ToolSet {
  return {
    report: reportTool(deps, chatId)
  }
}
