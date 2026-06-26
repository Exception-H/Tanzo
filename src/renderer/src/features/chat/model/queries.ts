import { useQuery } from '@tanstack/react-query'
import type { AgentKind } from '@shared/chat'
import { chatClient } from '@/platform/electron/chat-client'
import { policyClient } from '@/platform/electron/policy-client'
import { chatKeys } from './query-keys'

const CHAT_STALE_TIME = 30_000
const CHAT_GC_TIME = 30 * 60 * 1_000

export function useWorkspaces() {
  return useQuery({
    queryKey: chatKeys.workspaces(),
    queryFn: () => chatClient.listWorkspaces(),
    staleTime: CHAT_STALE_TIME,
    gcTime: CHAT_GC_TIME
  })
}

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: () => chatClient.listConversations(),
    staleTime: CHAT_STALE_TIME,
    gcTime: CHAT_GC_TIME
  })
}

export function useAgents(kind: AgentKind) {
  return useQuery({
    queryKey: chatKeys.agents(kind),
    queryFn: () => chatClient.listAgents(kind),
    staleTime: CHAT_STALE_TIME,
    gcTime: CHAT_GC_TIME
  })
}

export function usePolicyRules() {
  return useQuery({
    queryKey: chatKeys.policyRules(),
    queryFn: () => policyClient.listRules(),
    staleTime: CHAT_STALE_TIME,
    gcTime: CHAT_GC_TIME
  })
}

export function usePolicyMode(chatId?: string) {
  return useQuery({
    queryKey: chatKeys.policyMode(chatId),
    queryFn: () => policyClient.getMode(chatId),
    staleTime: CHAT_STALE_TIME,
    gcTime: CHAT_GC_TIME
  })
}
