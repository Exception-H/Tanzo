import { randomUUID } from 'crypto'
import { z } from 'zod'
import { POLICY_CHANNELS } from '@shared/policy'
import { optionalChatId, permissionModeSchema } from './schemas'
import type { AgentIpcDeps, IpcRegistration } from './types'

const PATTERN_MAX = 1000

const policyMatchSchema = z.object({
  toolName: z.string().max(PATTERN_MAX).optional(),
  toolNameGlob: z.string().max(PATTERN_MAX).optional(),
  argMatch: z
    .object({
      path: z.string().max(PATTERN_MAX),
      equals: z.string().max(PATTERN_MAX).optional(),
      regex: z.string().max(PATTERN_MAX).optional()
    })
    .optional()
})

const policyRuleInputSchema = z.object({
  id: z.string().optional(),
  match: policyMatchSchema,
  action: z.enum(['allow', 'deny', 'ask']),
  reason: z.string().optional(),
  scope: z.enum(['system', 'project', 'user']),
  priority: z.number().int()
})

export function policyHandlers(deps: AgentIpcDeps): IpcRegistration[] {
  return [
    [POLICY_CHANNELS.listRules, () => deps.policyStore.listRules()],
    [
      POLICY_CHANNELS.saveRule,
      (rule) => {
        const parsed = policyRuleInputSchema.parse(rule)
        return deps.policyStore.saveRule({ ...parsed, id: parsed.id ?? randomUUID() })
      }
    ],
    [POLICY_CHANNELS.deleteRule, (id) => deps.policyStore.deleteRule(z.string().min(1).parse(id))],
    [POLICY_CHANNELS.listDecisions, () => deps.policyStore.listDecisions()],
    [
      POLICY_CHANNELS.revokeDecision,
      (toolName, inputFingerprint, scopeTargetId) =>
        deps.policyStore.revokeDecision(
          z.string().min(1).parse(toolName),
          z.string().min(1).parse(inputFingerprint),
          scopeTargetId == null ? undefined : z.string().parse(scopeTargetId)
        )
    ],
    [POLICY_CHANNELS.getMode, (chatId) => deps.policy.getMode(optionalChatId(chatId))],
    [
      POLICY_CHANNELS.setMode,
      (mode, chatId) =>
        deps.policy.setMode(permissionModeSchema.parse(mode), optionalChatId(chatId))
    ]
  ]
}
