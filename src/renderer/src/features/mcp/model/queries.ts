import { useEffect } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  McpConnectionState,
  McpGetPromptResult,
  McpListPromptsResult,
  McpListResourcesResult,
  McpListResourceTemplatesResult,
  McpListToolsResult,
  McpReadResourceResult
} from '@/common/contracts'
import * as mcpClient from '@/platform/electron/mcp-client'
import { TanzoValidationError } from '@shared/errors'
import { mcpClientKeys, serverKeys } from './query-keys'

const SERVER_LIST_STALE_TIME = 30_000
const SERVER_LIST_GC_TIME = 30 * 60 * 1_000

export function useServers() {
  return useQuery({
    queryKey: serverKeys.lists(),
    queryFn: () => mcpClient.listServers(),
    staleTime: SERVER_LIST_STALE_TIME,
    gcTime: SERVER_LIST_GC_TIME
  })
}

const MCP_CLIENT_GC_TIME = 30 * 60 * 1_000
let connectionStateListenerRefCount = 0
let disposeConnectionStateListener: (() => void) | null = null

function startConnectionStateListener(queryClient: QueryClient) {
  if (disposeConnectionStateListener) return
  if (typeof window === 'undefined') return
  disposeConnectionStateListener = mcpClient.onConnectionStateChanged(
    (states: McpConnectionState[]) => {
      queryClient.setQueryData(mcpClientKeys.connectionStates(), [...states])
    }
  )
}

function stopConnectionStateListenerIfIdle() {
  if (connectionStateListenerRefCount > 0) return
  if (!disposeConnectionStateListener) return
  disposeConnectionStateListener()
  disposeConnectionStateListener = null
}

function useConnectionStates() {
  const queryClient = useQueryClient()

  useEffect(() => {
    connectionStateListenerRefCount += 1
    startConnectionStateListener(queryClient)
    return () => {
      connectionStateListenerRefCount = Math.max(0, connectionStateListenerRefCount - 1)
      stopConnectionStateListenerIfIdle()
    }
  }, [queryClient])

  return useQuery({
    queryKey: mcpClientKeys.connectionStates(),
    queryFn: async (): Promise<McpConnectionState[]> => {
      return mcpClient.getConnectionStates()
    },
    staleTime: 10_000,
    gcTime: MCP_CLIENT_GC_TIME
  })
}

export function useServerConnectionState(serverName: string): {
  state: McpConnectionState | null
  isLoading: boolean
} {
  const { data: states, isPending } = useConnectionStates()
  return {
    state: states?.find((s) => s.name === serverName) ?? null,
    isLoading: isPending
  }
}

export function useServerTools(serverName: string, enabled = true) {
  return useQuery({
    queryKey: mcpClientKeys.serverTools(serverName),
    queryFn: (): Promise<McpListToolsResult> => mcpClient.listTools(serverName),
    enabled,
    staleTime: 30_000,
    gcTime: MCP_CLIENT_GC_TIME
  })
}

export function useServerPrompts(serverName: string, enabled = true) {
  return useQuery({
    queryKey: mcpClientKeys.serverPrompts(serverName),
    queryFn: (): Promise<McpListPromptsResult> => mcpClient.listPrompts(serverName),
    enabled,
    staleTime: 30_000,
    gcTime: MCP_CLIENT_GC_TIME
  })
}

export function useServerResources(serverName: string, enabled = true) {
  return useQuery({
    queryKey: mcpClientKeys.serverResources(serverName),
    queryFn: (): Promise<McpListResourcesResult> => mcpClient.listResources(serverName),
    enabled,
    staleTime: 30_000,
    gcTime: MCP_CLIENT_GC_TIME
  })
}

export function useServerResourceTemplates(serverName: string, enabled = true) {
  return useQuery({
    queryKey: mcpClientKeys.serverResourceTemplates(serverName),
    queryFn: (): Promise<McpListResourceTemplatesResult> =>
      mcpClient.listResourceTemplates(serverName),
    enabled,
    staleTime: 30_000,
    gcTime: MCP_CLIENT_GC_TIME
  })
}

export function useServerResource(serverName: string, uri: string | null, enabled = true) {
  return useQuery({
    queryKey: mcpClientKeys.resource(serverName, uri ?? ''),
    queryFn: (): Promise<McpReadResourceResult> => {
      if (!uri) {
        throw new TanzoValidationError('MCP_RESOURCE_URI_REQUIRED', 'Resource URI is required')
      }
      return mcpClient.readResource(serverName, uri)
    },
    enabled: enabled && Boolean(uri),
    staleTime: 30_000,
    gcTime: MCP_CLIENT_GC_TIME
  })
}

export function useServerPrompt(
  serverName: string,
  promptName: string | null,
  args?: Record<string, unknown>,
  enabled = true
) {
  return useQuery({
    queryKey: mcpClientKeys.prompt(serverName, promptName ?? '', args),
    queryFn: (): Promise<McpGetPromptResult> => {
      if (!promptName) {
        throw new TanzoValidationError('MCP_PROMPT_NAME_REQUIRED', 'Prompt name is required')
      }
      return mcpClient.getPrompt(serverName, promptName, args)
    },
    enabled: enabled && Boolean(promptName),
    staleTime: 30_000,
    gcTime: MCP_CLIENT_GC_TIME
  })
}
