import type { ToolApprovalStatus } from 'ai'

export interface PolicyMatch {
  toolName?: string
  toolNameGlob?: string
  argMatch?: { path: string; equals?: string; regex?: string }
}

export interface PolicyRule {
  id: string
  match: PolicyMatch
  action: 'allow' | 'deny' | 'ask'
  reason?: string
  source: 'builtin' | 'user'
  scope: 'system' | 'project' | 'user'
  priority: number
  createdAt?: number
  updatedAt?: number
}

export type NewPolicyRuleInput = Omit<PolicyRule, 'id' | 'source' | 'createdAt' | 'updatedAt'> & {
  id?: string
}

export interface PolicyUserDecision {
  toolName: string
  inputFingerprint: string
  decision: 'approved' | 'denied'
  scope: 'session' | 'forever'
  decidedAt: number
  expiresAt?: number
  scopeTargetId?: string
}

export type PermissionMode = 'default' | 'plan' | 'yolo' | 'dangerous'

export const POLICY_CHANNELS = {
  listRules: 'policy:list-rules',
  saveRule: 'policy:save-rule',
  deleteRule: 'policy:delete-rule',
  listDecisions: 'policy:list-decisions',
  revokeDecision: 'policy:revoke-decision',
  getMode: 'policy:get-mode',
  setMode: 'policy:set-mode'
} as const

export type PolicyChannel = (typeof POLICY_CHANNELS)[keyof typeof POLICY_CHANNELS]

export type { ToolApprovalStatus }

export interface PolicyApi {
  listRules(): Promise<PolicyRule[]>
  saveRule(rule: NewPolicyRuleInput & { id?: string }): Promise<PolicyRule>
  deleteRule(id: string): Promise<void>
  listDecisions(): Promise<PolicyUserDecision[]>
  revokeDecision(toolName: string, inputFingerprint: string, scopeTargetId?: string): Promise<void>
  getMode(chatId?: string): Promise<PermissionMode>
  setMode(mode: PermissionMode, chatId?: string): Promise<void>
}
