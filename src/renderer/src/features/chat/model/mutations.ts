import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type {
  ConversationSummary,
  ForkConversationInput,
  ForkConversationResult,
  NewConversationInput
} from '@shared/chat'
import type { NewPolicyRuleInput, PermissionMode } from '@shared/policy'
import type {
  ProviderDefaultsState,
  ProviderId,
  ProviderSetupState,
  ProviderWorkspace
} from '@/common/contracts'
import { chatClient } from '@/platform/electron/chat-client'
import { policyClient } from '@/platform/electron/policy-client'
import { providersClient } from '@/platform/electron/providers-client'
import { providerKeys } from '@/features/providers/model/query-keys'
import { errorMessage } from '@/common/lib/error-utils'
import { chatKeys } from './query-keys'

function invalidateChatCollections(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
  queryClient.invalidateQueries({ queryKey: chatKeys.workspaces() })
}

export function useCreateConversation() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input?: NewConversationInput) => chatClient.createConversation(input),
    onSuccess: () => invalidateChatCollections(queryClient),
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.startRun')))
  })
}

export function useForkConversation() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ForkConversationInput): Promise<ForkConversationResult> =>
      chatClient.forkConversation(input),
    onSuccess: () => {
      invalidateChatCollections(queryClient)
    },
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.forkConversation')))
  })
}

export function useDeleteConversation() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (chatId: string) => chatClient.deleteConversation(chatId),
    onSuccess: (_result, chatId) => {
      queryClient.setQueryData<ConversationSummary[]>(chatKeys.conversations(), (list) =>
        list ? list.filter((conversation) => conversation.id !== chatId) : list
      )
      invalidateChatCollections(queryClient)
    },
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.deleteConversation')))
  })
}

export function useDeleteWorkspace() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workspaceId: string) => chatClient.deleteWorkspace(workspaceId),
    onSuccess: (_result, workspaceId) => {
      queryClient.setQueryData<ConversationSummary[]>(chatKeys.conversations(), (list) =>
        list ? list.filter((conversation) => conversation.workspaceId !== workspaceId) : list
      )
      invalidateChatCollections(queryClient)
    },
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.deleteConversation')))
  })
}

export function useSetConversationTitle() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { chatId: string; title: string }) =>
      chatClient.setConversationTitle(input.chatId, input.title),
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationSummary[]>(chatKeys.conversations(), (list) =>
        list ? list.map((c) => (c.id === updated.id ? updated : c)) : list
      )
    },
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.renameConversation')))
  })
}

export function useSetPolicyMode() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mode, chatId }: { mode: PermissionMode; chatId?: string }) =>
      policyClient.setMode(mode, chatId),
    onSuccess: (_result, { mode, chatId }) => {
      queryClient.setQueryData(chatKeys.policyMode(chatId), mode)
    },
    onError: (error) => toast.error(errorMessage(error, t('policy.notifications.modeChangeFailed')))
  })
}

export function useSavePolicyRule() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rule: NewPolicyRuleInput & { id?: string }) => policyClient.saveRule(rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.policyRules() })
      toast.success(t('policy.notifications.ruleSaved'))
    },
    onError: (error) => toast.error(errorMessage(error, t('policy.notifications.ruleSaveFailed')))
  })
}

export function useRevokeDecision() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { toolName: string; inputFingerprint: string; scopeTargetId?: string }) =>
      policyClient.revokeDecision(input.toolName, input.inputFingerprint, input.scopeTargetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.policyDecisions() })
      toast.success(t('policy.notifications.decisionRevoked'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('policy.notifications.decisionRevokeFailed')))
  })
}

export function useSetConversationModel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { chatId: string; modelRef: string }) =>
      chatClient.setConversationModel(input.chatId, input.modelRef),
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationSummary[]>(chatKeys.conversations(), (list) =>
        list ? list.map((c) => (c.id === updated.id ? updated : c)) : list
      )
    },
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.setModel')))
  })
}

export function useSetConversationSubagentModel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { chatId: string; modelRef: string }) =>
      chatClient.setConversationSubagentModel(input.chatId, input.modelRef),
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationSummary[]>(chatKeys.conversations(), (list) =>
        list ? list.map((c) => (c.id === updated.id ? updated : c)) : list
      )
    },
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.setModel')))
  })
}

export function useSetConversationAgent() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { chatId: string; agentId: string }) =>
      chatClient.setConversationAgent(input.chatId, input.agentId),
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationSummary[]>(chatKeys.conversations(), (list) =>
        list ? list.map((c) => (c.id === updated.id ? updated : c)) : list
      )
    },
    onError: (error) => toast.error(errorMessage(error, t('chat.errors.setAgent')))
  })
}

function patchSetupLanguageDefaults(
  setups: ProviderSetupState[] | undefined,
  providerId: ProviderId,
  defaults: ProviderDefaultsState
): ProviderSetupState[] | undefined {
  if (!setups) return setups
  return setups.map((setup) => {
    if (setup.providerId !== providerId) return setup
    const language = setup.modalities.language
    if (!language) return setup
    return {
      ...setup,
      modalities: { ...setup.modalities, language: { ...language, defaults } }
    }
  })
}

export function useSaveLanguageDefaults() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { providerId: ProviderId; defaults: ProviderDefaultsState }) =>
      providersClient.saveDefaults({
        providerId: input.providerId,
        byFamily: { language: input.defaults }
      }),
    onMutate: (input) => {
      queryClient.setQueryData<ProviderSetupState[]>(providerKeys.setups(), (setups) =>
        patchSetupLanguageDefaults(setups, input.providerId, input.defaults)
      )
    },
    onSuccess: (workspace: ProviderWorkspace, input) => {
      queryClient.setQueryData(providerKeys.workspace(input.providerId), workspace)
      queryClient.invalidateQueries({ queryKey: providerKeys.setups() })
    },
    onError: (error, input) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.setups() })
      queryClient.invalidateQueries({ queryKey: providerKeys.workspace(input.providerId) })
      toast.error(errorMessage(error, t('chat.errors.setReasoningEffort')))
    }
  })
}
