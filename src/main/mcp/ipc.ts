import type { IpcMain } from 'electron'
import { z } from 'zod'
import { MCP_CHANNELS, type McpElicitResult } from '@shared/mcp'
import { registerIpcHandlers, type IpcRegistration } from '../ipc/router'
import type { McpService } from './service'

const mcpTransportSchema = z.enum(['stdio', 'sse', 'http'])
const mcpRedirectSchema = z.enum(['follow', 'error'])
const stringRecordSchema = z.record(z.string(), z.string())
const serverNameSchema = z.string().trim().min(1)
const serverIdSchema = z.string().trim().min(1)
const mcpServerInputSchema = z.object({
  name: serverNameSchema,
  description: z.string().optional(),
  transport: mcpTransportSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().optional(),
  headers: stringRecordSchema.optional(),
  redirect: mcpRedirectSchema.optional(),
  env: stringRecordSchema.optional(),
  enabled: z.boolean()
})
const mcpServerUpdateSchema = mcpServerInputSchema.partial()
const elicitationResultSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel']),
  content: z.record(z.string(), z.unknown()).optional()
})

export interface McpIpcHandlers {
  resolveElicitation(requestId: string, result: McpElicitResult): void
}

export function registerMcpIpc(
  ipcMain: IpcMain,
  service: McpService,
  handlers: McpIpcHandlers
): () => void {
  const channels = [
    [MCP_CHANNELS.listServers, () => service.listServers()],
    [
      MCP_CHANNELS.createServer,
      (input: unknown) => service.createServer(mcpServerInputSchema.parse(input))
    ],
    [
      MCP_CHANNELS.updateServer,
      (id: unknown, partial: unknown) =>
        service.updateServer(serverIdSchema.parse(id), mcpServerUpdateSchema.parse(partial))
    ],
    [MCP_CHANNELS.deleteServer, (id: unknown) => service.deleteServer(serverIdSchema.parse(id))],
    [
      MCP_CHANNELS.toggleServer,
      (id: unknown, enabled: unknown) =>
        service.toggleServer(serverIdSchema.parse(id), z.boolean().parse(enabled))
    ],
    [MCP_CHANNELS.getConnectionStates, () => service.listConnectionStates()],
    [
      MCP_CHANNELS.listTools,
      (serverName: unknown) => service.listTools(serverNameSchema.parse(serverName))
    ],
    [
      MCP_CHANNELS.listResources,
      (serverName: unknown) => service.listResources(serverNameSchema.parse(serverName))
    ],
    [
      MCP_CHANNELS.readResource,
      (serverName: unknown, uri: unknown) =>
        service.readResource(serverNameSchema.parse(serverName), z.string().min(1).parse(uri))
    ],
    [
      MCP_CHANNELS.listResourceTemplates,
      (serverName: unknown) => service.listResourceTemplates(serverNameSchema.parse(serverName))
    ],
    [
      MCP_CHANNELS.listPrompts,
      (serverName: unknown) => service.listPrompts(serverNameSchema.parse(serverName))
    ],
    [
      MCP_CHANNELS.getPrompt,
      (serverName: unknown, promptName: unknown, args?: unknown) =>
        service.getPrompt(
          serverNameSchema.parse(serverName),
          z.string().min(1).parse(promptName),
          args === undefined ? undefined : z.record(z.string(), z.unknown()).parse(args)
        )
    ],
    [
      MCP_CHANNELS.reconnectServer,
      (serverName: unknown) => service.reconnectServer(serverNameSchema.parse(serverName))
    ],
    [
      MCP_CHANNELS.resolveElicitation,
      (requestId: unknown, result: unknown) =>
        handlers.resolveElicitation(
          z.string().uuid().parse(requestId),
          elicitationResultSchema.parse(result)
        )
    ]
  ] as const

  return registerIpcHandlers(ipcMain, channels as readonly IpcRegistration[])
}
