export const serverKeys = {
  all: ['mcp'] as const,
  lists: () => [...serverKeys.all, 'servers', 'list'] as const
}

export const mcpClientKeys = {
  all: ['mcp'] as const,
  tools: () => [...mcpClientKeys.all, 'client', 'tools'] as const,
  serverTools: (serverName: string) => [...mcpClientKeys.tools(), serverName] as const,
  prompts: () => [...mcpClientKeys.all, 'client', 'prompts'] as const,
  serverPrompts: (serverName: string) => [...mcpClientKeys.prompts(), serverName] as const,
  prompt: (serverName: string, promptName: string, args?: Record<string, unknown>) =>
    [...mcpClientKeys.serverPrompts(serverName), 'detail', promptName, args] as const,
  resources: () => [...mcpClientKeys.all, 'client', 'resources'] as const,
  serverResources: (serverName: string) => [...mcpClientKeys.resources(), serverName] as const,
  resource: (serverName: string, uri: string) =>
    [...mcpClientKeys.serverResources(serverName), 'detail', uri] as const,
  resourceTemplates: () => [...mcpClientKeys.all, 'client', 'resourceTemplates'] as const,
  serverResourceTemplates: (serverName: string) =>
    [...mcpClientKeys.resourceTemplates(), serverName] as const,
  connectionStates: () => [...mcpClientKeys.all, 'client', 'connectionStates'] as const
}
