import { tool, zodSchema, type Tool } from 'ai'
import type { TanzoTools } from '@shared/agent-message'
import type { ToolDeps } from './types'
import { toolResultToModelOutput } from './model-output'
import { skillInputSchema } from './tool-schemas'

type SkillInput = TanzoTools['skill']['input']
type SkillOutput = TanzoTools['skill']['output']

export function skillTool(deps: ToolDeps): Tool<SkillInput, SkillOutput> {
  return tool<SkillInput, SkillOutput, Record<string, unknown>>({
    description:
      'Load the full instructions for one available skill. Use only after deciding the task matches ' +
      "that skill's description; the result may also narrow which tools are allowed.",
    inputSchema: zodSchema(skillInputSchema),
    metadata: { tanzo: { kind: 'read', component: 'SkillCard' } },
    toModelOutput: toolResultToModelOutput,
    execute: ({ skill, args }): SkillOutput => {
      const resolved = deps.skills.listEnabled().find((entry) => entry.name === skill)
      if (!resolved) {
        return { error: true, message: `Unknown skill '${skill}'. See Available Skills.` }
      }
      deps.fs.registerReadRoot(resolved.skillDir)
      return {
        instructions: resolved.body,
        skillDir: resolved.skillDir,
        args: args ?? null,
        allowedTools: resolved.allowedTools
      }
    }
  })
}
