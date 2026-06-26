import { tool, zodSchema, type Tool } from 'ai'
import type { ToolResultOutput } from '@ai-sdk/provider-utils'
import type { AskQuestionAnswered, TanzoTools } from '@shared/agent-message'
import { isStructuredToolError } from './model-output'
import { askQuestionInputSchema } from './tool-schemas'
import type { ToolDeps } from './types'

const DESC =
  'Present tappable options to gather the user\u2019s preferences, constraints, or goals before acting. ' +
  'Ask one to three short, blocking questions and wait for the answers before continuing. ' +
  'WHEN TO USE: elicitation \u2014 when you need the user\u2019s preferences or constraints to proceed and the ' +
  'answer is not already in the conversation or inferable from the workspace. Prefer this over writing ' +
  'clarifying questions as prose bullets. WHEN NOT TO USE: the user asked "A or B?" and wants your ' +
  'recommendation; the answer is already given or inferable; permission/plan approval; or routine ' +
  '"should I continue?" prompts. Each question needs 2-8 options with short labels and a type: ' +
  '"single_select" (choose one), "multi_select" (choose one or more), or "rank_priorities" ' +
  '(drag to order every option). Set allowCustom when the user may need to answer outside the options ' +
  '(not allowed for rank_priorities). Keep it to one question where possible; three is a ceiling.'

function askQuestionModelOutput({
  output
}: {
  output: TanzoTools['askQuestion']['output']
}): ToolResultOutput {
  if (isStructuredToolError(output)) return { type: 'error-text', value: output.message }
  if ('declined' in output) {
    const base =
      'The user declined to answer and wants to discuss this first instead of selecting an option.'
    return { type: 'text', value: output.note ? `${base}\nUser note: ${output.note}` : base }
  }
  return {
    type: 'text',
    value: summarizeAnswers(output)
  }
}

function summarizeAnswers(output: AskQuestionAnswered): string {
  return output.answers
    .map((answer) => {
      const display = answer.values.map((value, index) => {
        const label = answer.labels?.[index]
        return label && label !== value ? `${value} (${label})` : value
      })
      const joined =
        answer.type === 'rank_priorities'
          ? display.map((entry, index) => `${index + 1}. ${entry}`).join(', ')
          : display.join(', ')
      return `${answer.id}: ${joined}`
    })
    .join('\n')
}

export function askQuestionTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['askQuestion']['input'], TanzoTools['askQuestion']['output']> {
  return tool<
    TanzoTools['askQuestion']['input'],
    TanzoTools['askQuestion']['output'],
    Record<string, unknown>
  >({
    description: DESC,
    inputSchema: zodSchema(askQuestionInputSchema),
    metadata: { tanzo: { kind: 'read', component: 'AskQuestionCard' } },
    toModelOutput: askQuestionModelOutput,
    async execute(input, { toolCallId, abortSignal }) {
      return deps.questions.ask(chatId, toolCallId, input, abortSignal)
    }
  }) as Tool<TanzoTools['askQuestion']['input'], TanzoTools['askQuestion']['output']>
}
