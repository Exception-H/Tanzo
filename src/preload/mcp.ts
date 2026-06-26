import {
  MCP_CHANNELS,
  type McpApi,
  type McpConnectionState,
  type McpElicitationRequest
} from '@shared/mcp'
import { invoke, subscribe } from './invoke'

export const mcpApi: McpApi = {
  listServers: invoke<McpApi['listServers']>(MCP_CHANNELS.listServers),
  createServer: invoke<McpApi['createServer']>(MCP_CHANNELS.createServer),
  updateServer: invoke<McpApi['updateServer']>(MCP_CHANNELS.updateServer),
  deleteServer: invoke<McpApi['deleteServer']>(MCP_CHANNELS.deleteServer),
  toggleServer: invoke<McpApi['toggleServer']>(MCP_CHANNELS.toggleServer),
  getConnectionStates: invoke<McpApi['getConnectionStates']>(MCP_CHANNELS.getConnectionStates),
  onConnectionStatesChanged: (callback) =>
    subscribe<McpConnectionState[]>(MCP_CHANNELS.connectionStatesChanged, callback),
  listTools: invoke<McpApi['listTools']>(MCP_CHANNELS.listTools),
  listResources: invoke<McpApi['listResources']>(MCP_CHANNELS.listResources),
  readResource: invoke<McpApi['readResource']>(MCP_CHANNELS.readResource),
  listResourceTemplates: invoke<McpApi['listResourceTemplates']>(
    MCP_CHANNELS.listResourceTemplates
  ),
  listPrompts: invoke<McpApi['listPrompts']>(MCP_CHANNELS.listPrompts),
  getPrompt: invoke<McpApi['getPrompt']>(MCP_CHANNELS.getPrompt),
  reconnectServer: invoke<McpApi['reconnectServer']>(MCP_CHANNELS.reconnectServer),
  onElicitationRequested: (callback) =>
    subscribe<McpElicitationRequest>(MCP_CHANNELS.elicitationRequested, callback),
  resolveElicitation: invoke<McpApi['resolveElicitation']>(MCP_CHANNELS.resolveElicitation)
}

export type McpPreloadApi = typeof mcpApi
