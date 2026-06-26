import { describe, expect, it, vi } from 'vitest'
import { MCP_CHANNELS } from '@shared/mcp'
import { registerMcpIpc } from '@main/mcp/ipc'

type Handler = (_event: unknown, ...args: unknown[]) => unknown

function ipcTarget() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    target: {
      handle: vi.fn((channel: string, handler: Handler) => {
        handlers.set(channel, handler)
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel)
      })
    }
  }
}

function service() {
  return {
    listServers: vi.fn(() => ['server']),
    createServer: vi.fn((input: unknown) => ({ created: input })),
    updateServer: vi.fn((id: string, partial: unknown) => ({ id, partial })),
    deleteServer: vi.fn((id: string) => id === 'server-1'),
    toggleServer: vi.fn((id: string, enabled: boolean) => ({ id, enabled })),
    listConnectionStates: vi.fn(() => [{ name: 'local', status: 'connected' }]),
    listTools: vi.fn((serverName: string) => ({ tools: [{ name: serverName }] })),
    listResources: vi.fn((serverName: string) => ({ resources: [{ name: serverName }] })),
    readResource: vi.fn((serverName: string, uri: string) => ({ contents: [{ serverName, uri }] })),
    listResourceTemplates: vi.fn((serverName: string) => ({
      resourceTemplates: [{ name: serverName }]
    })),
    listPrompts: vi.fn((serverName: string) => ({ prompts: [{ name: serverName }] })),
    getPrompt: vi.fn((serverName: string, promptName: string, args?: unknown) => ({
      serverName,
      promptName,
      args
    })),
    reconnectServer: vi.fn()
  }
}

describe('mcp/ipc', () => {
  it('registers MCP handlers that validate payloads and delegate', async () => {
    const fakeService = service()
    const handlersApi = { resolveElicitation: vi.fn() }
    const { handlers, target } = ipcTarget()

    const unregister = registerMcpIpc(target as never, fakeService as never, handlersApi)
    expect(target.handle).toHaveBeenCalledTimes(
      Object.keys(MCP_CHANNELS).filter(
        (channel) => channel !== 'connectionStatesChanged' && channel !== 'elicitationRequested'
      ).length
    )

    expect(await handlers.get(MCP_CHANNELS.listServers)?.(null)).toEqual(['server'])

    const input = {
      name: 'local',
      description: 'Local',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      cwd: '/tmp',
      headers: { authorization: 'token' },
      env: { A: 'B' },
      enabled: true
    }
    expect(await handlers.get(MCP_CHANNELS.createServer)?.(null, input)).toEqual({
      created: input
    })
    expect(
      await handlers.get(MCP_CHANNELS.updateServer)?.(null, 'server-1', { enabled: false })
    ).toEqual({
      id: 'server-1',
      partial: { enabled: false }
    })
    expect(await handlers.get(MCP_CHANNELS.deleteServer)?.(null, 'server-1')).toBe(true)
    expect(await handlers.get(MCP_CHANNELS.toggleServer)?.(null, 'server-1', false)).toEqual({
      id: 'server-1',
      enabled: false
    })
    expect(await handlers.get(MCP_CHANNELS.getConnectionStates)?.(null)).toEqual([
      { name: 'local', status: 'connected' }
    ])
    expect(await handlers.get(MCP_CHANNELS.listTools)?.(null, 'local')).toEqual({
      tools: [{ name: 'local' }]
    })
    expect(await handlers.get(MCP_CHANNELS.listResources)?.(null, 'local')).toEqual({
      resources: [{ name: 'local' }]
    })
    expect(await handlers.get(MCP_CHANNELS.readResource)?.(null, 'local', 'file:///a')).toEqual({
      contents: [{ serverName: 'local', uri: 'file:///a' }]
    })
    expect(await handlers.get(MCP_CHANNELS.listResourceTemplates)?.(null, 'local')).toEqual({
      resourceTemplates: [{ name: 'local' }]
    })
    expect(await handlers.get(MCP_CHANNELS.listPrompts)?.(null, 'local')).toEqual({
      prompts: [{ name: 'local' }]
    })
    expect(await handlers.get(MCP_CHANNELS.getPrompt)?.(null, 'local', 'p', { a: 1 })).toEqual({
      serverName: 'local',
      promptName: 'p',
      args: { a: 1 }
    })
    await handlers.get(MCP_CHANNELS.reconnectServer)?.(null, 'local')
    expect(fakeService.reconnectServer).toHaveBeenCalledWith('local')

    const requestId = '123e4567-e89b-12d3-a456-426614174000'
    handlers.get(MCP_CHANNELS.resolveElicitation)?.(null, requestId, {
      action: 'accept',
      content: { value: 1 }
    })
    expect(handlersApi.resolveElicitation).toHaveBeenCalledWith(requestId, {
      action: 'accept',
      content: { value: 1 }
    })

    expect(() => handlers.get(MCP_CHANNELS.deleteServer)?.(null, '')).toThrow()
    expect(() => handlers.get(MCP_CHANNELS.listTools)?.(null, '')).toThrow()
    expect(() =>
      handlers.get(MCP_CHANNELS.resolveElicitation)?.(null, 'bad-id', { action: 'accept' })
    ).toThrow()

    unregister()
    expect(target.removeHandler).toHaveBeenCalledTimes(28)
  })
})
