import type {
  NewPolicyRuleInput,
  PermissionMode,
  PolicyApi,
  PolicyRule,
  PolicyUserDecision
} from '@shared/policy'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

export function requirePolicyApi(): PolicyApi {
  const policyApi = window.electron?.policy
  if (!policyApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_POLICY_API_UNAVAILABLE',
      'Electron policy API is not available'
    )
  }
  return withDecodedIpcErrors(policyApi)
}

export const policyClient = {
  listRules(): Promise<PolicyRule[]> {
    return requirePolicyApi()
      .listRules()
      .then((rules) => [...rules])
  },
  saveRule(rule: NewPolicyRuleInput & { id?: string }): Promise<PolicyRule> {
    return requirePolicyApi().saveRule(rule)
  },
  async deleteRule(id: string): Promise<void> {
    await requirePolicyApi().deleteRule(id)
  },
  listDecisions(): Promise<PolicyUserDecision[]> {
    return requirePolicyApi()
      .listDecisions()
      .then((decisions) => [...decisions])
  },
  revokeDecision(
    toolName: string,
    inputFingerprint: string,
    scopeTargetId?: string
  ): Promise<void> {
    return requirePolicyApi().revokeDecision(toolName, inputFingerprint, scopeTargetId)
  },
  getMode(chatId?: string): Promise<PermissionMode> {
    return requirePolicyApi().getMode(chatId)
  },
  async setMode(mode: PermissionMode, chatId?: string): Promise<void> {
    await requirePolicyApi().setMode(mode, chatId)
  }
}
