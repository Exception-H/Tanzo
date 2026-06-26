import type {
  McpConnectionState,
  McpElicitResult,
  McpElicitationRequest,
  McpGetPromptResult,
  McpListPromptsResult,
  McpListResourcesResult,
  McpListResourceTemplatesResult,
  McpListToolsResult,
  McpReadResourceResult,
  McpServerConfig,
  NewMcpServerInput
} from '@/common/contracts'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

function requireMcpApi() {
  const mcpApi = window.electron?.mcp
  if (!mcpApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_MCP_API_UNAVAILABLE',
      'Electron MCP API is not available'
    )
  }
  return withDecodedIpcErrors(mcpApi)
}

export function listServers(): Promise<McpServerConfig[]> {
  return requireMcpApi()
    .listServers()
    .then((servers) => [...servers])
}

export function createServer(input: NewMcpServerInput): Promise<McpServerConfig> {
  return requireMcpApi().createServer(input)
}

export function updateServer(
  id: string,
  partial: Partial<McpServerConfig>
): Promise<McpServerConfig | undefined> {
  return requireMcpApi().updateServer(id, partial)
}

export function deleteServer(id: string): Promise<boolean> {
  return requireMcpApi().deleteServer(id)
}

export function toggleServer(id: string, enabled: boolean): Promise<McpServerConfig | undefined> {
  return requireMcpApi().toggleServer(id, enabled)
}

export function getConnectionStates(): Promise<McpConnectionState[]> {
  return requireMcpApi()
    .getConnectionStates()
    .then((states) => [...states])
}

export function onConnectionStateChanged(
  callback: (states: McpConnectionState[]) => void
): () => void {
  return requireMcpApi().onConnectionStatesChanged((states) => callback([...states]))
}

export function listTools(serverName: string): Promise<McpListToolsResult> {
  return requireMcpApi()
    .listTools(serverName)
    .then((result) => ({
      ...result,
      tools: [...result.tools]
    }))
}

export function listResources(serverName: string): Promise<McpListResourcesResult> {
  return requireMcpApi()
    .listResources(serverName)
    .then((result) => ({
      ...result,
      resources: [...result.resources]
    }))
}

export function readResource(serverName: string, uri: string): Promise<McpReadResourceResult> {
  return requireMcpApi()
    .readResource(serverName, uri)
    .then((result) => ({
      ...result,
      contents: [...result.contents]
    }))
}

export function listResourceTemplates(serverName: string): Promise<McpListResourceTemplatesResult> {
  return requireMcpApi()
    .listResourceTemplates(serverName)
    .then((result) => ({
      ...result,
      resourceTemplates: [...result.resourceTemplates]
    }))
}

export function listPrompts(serverName: string): Promise<McpListPromptsResult> {
  return requireMcpApi()
    .listPrompts(serverName)
    .then((result) => ({
      ...result,
      prompts: [...result.prompts]
    }))
}

export function getPrompt(
  serverName: string,
  promptName: string,
  args?: Record<string, unknown>
): Promise<McpGetPromptResult> {
  return requireMcpApi()
    .getPrompt(serverName, promptName, args)
    .then((result) => ({
      ...result,
      messages: [...result.messages]
    }))
}

export function onElicitationRequested(
  callback: (request: McpElicitationRequest) => void
): () => void {
  return requireMcpApi().onElicitationRequested(callback)
}

export async function resolveElicitation(
  requestId: string,
  result: McpElicitResult
): Promise<void> {
  await requireMcpApi().resolveElicitation(requestId, result)
}

export async function reconnectServer(serverName: string): Promise<void> {
  await requireMcpApi().reconnectServer(serverName)
}
