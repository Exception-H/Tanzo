import { z } from 'zod'
import { SKILL_CHANNELS } from '@shared/skills'
import type { AgentIpcDeps, IpcRegistration } from './types'

const skillNameSchema = z.string().trim().min(1)

const setEnabledSchema = z.object({
  name: skillNameSchema,
  enabled: z.boolean()
})

const installSchema = z.object({
  sourcePath: z.string().trim().min(1),
  scope: z.enum(['user', 'workspace']),
  enableAfterInstall: z.boolean().optional(),
  replace: z.boolean().optional()
})

export function skillHandlers(deps: AgentIpcDeps): IpcRegistration[] {
  return [
    [SKILL_CHANNELS.list, () => deps.skills.snapshot()],
    [SKILL_CHANNELS.get, (name) => deps.skills.detail(skillNameSchema.parse(name))],
    [
      SKILL_CHANNELS.setEnabled,
      (input) => {
        const parsed = setEnabledSchema.parse(input)
        return deps.skills.setEnabled(parsed.name, parsed.enabled)
      }
    ],
    [SKILL_CHANNELS.install, (input) => deps.skills.install(installSchema.parse(input))],
    [SKILL_CHANNELS.uninstall, (name) => deps.skills.uninstall(skillNameSchema.parse(name))],
    [SKILL_CHANNELS.reload, () => deps.skills.reload()]
  ]
}
