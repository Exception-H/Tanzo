import { describe, expect, it, vi } from 'vitest'
import { MCP_CHANNELS } from '@shared/mcp'

const mocks = vi.hoisted(() => {
  const logger = { info: vi.fn() }
  const store = { kind: 'store' }
  const service = {
    syncFromStore: vi.fn(async () => undefined),
    onConnectionStatesChanged: vi.fn((listener: (states: unknown[]) => void) => {
      void listener
      return vi.fn()
    }),
    dispose: vi.fn(async () => undefined)
  }
  const unregister = vi.fn()
  const clientOptions: unknown[] = []
  const ipcHandlers: unknown[] = []

  class FakeMcpClient {
    constructor(options: unknown) {
      clientOptions.push(options)
    }
  }

  return {
    logger,
    store,
    service,
    unregister,
    clientOptions,
    ipcHandlers,
    FakeMcpClient,
    createMcpStore: vi.fn(() => store),
    createMcpService: vi.fn(() => service),
    registerMcpIpc: vi.fn((_ipcMain: unknown, _service: unknown, handlers: unknown) => {
      ipcHandlers.push(handlers)
      return unregister
    })
  }
})

vi.mock('@main/logger', () => ({
  createLogger: vi.fn(() => mocks.logger)
}))

vi.mock('@main/mcp/client', () => ({
  McpClient: mocks.FakeMcpClient
}))

vi.mock('@main/mcp/store', () => ({
  createMcpStore: mocks.createMcpStore
}))

vi.mock('@main/mcp/service', () => ({
  createMcpService: mocks.createMcpService
}))

vi.mock('@main/mcp/ipc', () => ({
  registerMcpIpc: mocks.registerMcpIpc
}))

function window(send = vi.fn(), destroyed = false, webContentsDestroyed = false) {
  return {
    isDestroyed: vi.fn(() => destroyed),
    webContents: {
      isDestroyed: vi.fn(() => webContentsDestroyed),
      send
    }
  }
}

describe('mcp/module', () => {
  it('wires MCP client/service, broadcasts state changes, and resolves elicitation requests', async () => {
    const { createMcpModule } = await import('@main/mcp/module')
    const primarySend = vi.fn()
    const secondarySend = vi.fn()
    const primary = window(primarySend)
    const secondary = window(secondarySend)
    const db = { prepare: vi.fn() }

    const module = createMcpModule({
      db: db as never,
      getWindows: () => [primary, window(vi.fn(), true), secondary],
      elicitationTimeoutMs: 1000,
      connectTimeoutMs: 50,
      requestTimeoutMs: 60,
      enableReconnect: false,
      appName: 'Tanzo Test',
      appVersion: '9.9.9'
    })

    expect(module.service).toBe(mocks.service)
    expect(mocks.createMcpStore).toHaveBeenCalledWith(db)
    expect(mocks.createMcpService).toHaveBeenCalledWith(
      mocks.store,
      expect.any(mocks.FakeMcpClient)
    )
    expect(mocks.clientOptions[0]).toMatchObject({
      appName: 'Tanzo Test',
      appVersion: '9.9.9',
      connectTimeoutMs: 50,
      requestTimeoutMs: 60,
      enableReconnect: false
    })
    expect(mocks.logger.info).toHaveBeenCalledWith('initialized')

    await module.initialize()
    expect(mocks.service.syncFromStore).toHaveBeenCalled()
    const listener = mocks.service.onConnectionStatesChanged.mock.calls[0][0] as (
      states: unknown[]
    ) => void
    listener([{ name: 'local', status: 'connected' }])
    expect(primarySend).toHaveBeenCalledWith(MCP_CHANNELS.connectionStatesChanged, [
      { name: 'local', status: 'connected' }
    ])
    expect(secondarySend).toHaveBeenCalledWith(MCP_CHANNELS.connectionStatesChanged, [
      { name: 'local', status: 'connected' }
    ])

    module.registerIpc({ handle: vi.fn(), removeHandler: vi.fn() } as never)
    module.registerIpc({ handle: vi.fn(), removeHandler: vi.fn() } as never)
    expect(mocks.registerMcpIpc).toHaveBeenCalledTimes(2)
    expect(mocks.unregister).toHaveBeenCalledTimes(1)

    const options = mocks.clientOptions[0] as {
      handleElicitationRequest(input: {
        serverName: string
        message: string
        requestedSchema: unknown
      }): Promise<unknown>
    }
    const elicitation = options.handleElicitationRequest({
      serverName: 'local',
      message: 'Need a value',
      requestedSchema: { type: 'object' }
    })
    const request = primarySend.mock.calls.find(
      ([channel]) => channel === MCP_CHANNELS.elicitationRequested
    )?.[1] as { requestId: string }
    expect(request).toMatchObject({
      serverName: 'local',
      message: 'Need a value',
      requestedSchema: { type: 'object' }
    })
    const ipcHandlers = mocks.ipcHandlers.at(-1) as {
      resolveElicitation(requestId: string, result: unknown): void
    }
    ipcHandlers.resolveElicitation(request.requestId, {
      action: 'accept',
      content: { value: 'ok' }
    })
    await expect(elicitation).resolves.toEqual({
      action: 'accept',
      content: { value: 'ok' }
    })

    await module.close()
    expect(mocks.unregister).toHaveBeenCalledTimes(2)
    expect(mocks.service.dispose).toHaveBeenCalled()
    expect(mocks.logger.info).toHaveBeenCalledWith('closed')
  })

  it('cancels elicitation when no usable window is available', async () => {
    const { createMcpModule } = await import('@main/mcp/module')
    const module = createMcpModule({
      db: {} as never,
      getWindows: () => [window(vi.fn(), true), window(vi.fn(), false, true)]
    })
    expect(module.service).toBe(mocks.service)
    const options = mocks.clientOptions.at(-1) as {
      handleElicitationRequest(input: {
        serverName: string
        message: string
        requestedSchema: unknown
      }): Promise<unknown>
    }

    await expect(
      options.handleElicitationRequest({
        serverName: 'hidden',
        message: 'No window',
        requestedSchema: {}
      })
    ).resolves.toEqual({ action: 'cancel' })
  })
})
