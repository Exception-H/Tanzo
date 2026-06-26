import type { ModelMessage, ToolApprovalStatus } from 'ai'
import type { PermissionMode, PolicyRule, PolicyUserDecision } from '@shared/policy'

export interface PolicyStore {
  listRules(): PolicyRule[]
  saveRule(
    rule: Omit<PolicyRule, 'source' | 'createdAt' | 'updatedAt'> & { id: string }
  ): PolicyRule
  deleteRule(id: string): void
  listDecisions(): PolicyUserDecision[]
  saveDecision(decision: PolicyUserDecision): void
  revokeDecision(toolName: string, inputFingerprint: string, scopeTargetId?: string): void
  listModes(): Array<{ chatId: string; mode: PermissionMode }>
  saveMode(chatId: string, mode: PermissionMode): void
}

export interface PolicyDecisionInput {
  toolCall: {
    toolName: string
    input: unknown
    kind?: ToolPolicyKind
    fingerprintFields?: string[]
  }
  messages: ModelMessage[]
  runtimeContext: unknown
}

export type ToolPolicyKind = 'read' | 'search' | 'edit' | 'exec'

export interface PolicyEngine {
  decide(input: PolicyDecisionInput): ToolApprovalStatus | Promise<ToolApprovalStatus>
  getMode(chatId?: string): PermissionMode
  setMode(mode: PermissionMode, chatId?: string): void
  remember(decision: PolicyUserDecision, chatId?: string): void
}
