import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const logger = { info: vi.fn() }
  const store = { kind: 'store' }
  const codec = { kind: 'codec' }
  const service = { kind: 'service' }
  const unregister = vi.fn()
  return {
    logger,
    store,
    codec,
    service,
    unregister,
    createProviderStore: vi.fn(() => store),
    createSecretCodec: vi.fn(() => codec),
    createProviderService: vi.fn(() => service),
    registerProviderIpc: vi.fn(() => unregister)
  }
})

vi.mock('@main/logger', () => ({
  createLogger: vi.fn(() => mocks.logger)
}))

vi.mock('@main/provider/store', () => ({
  createProviderStore: mocks.createProviderStore
}))

vi.mock('@main/provider/secret', () => ({
  createSecretCodec: mocks.createSecretCodec
}))

vi.mock('@main/provider/service', () => ({
  createProviderService: mocks.createProviderService
}))

vi.mock('@main/provider/ipc', () => ({
  registerProviderIpc: mocks.registerProviderIpc
}))

describe('provider/module', () => {
  it('wires provider store, service, IPC lifecycle, and close logging', async () => {
    const { createProviderModule } = await import('@main/provider/module')
    const db = { prepare: vi.fn() }
    const ipcMain = { handle: vi.fn(), removeHandler: vi.fn() }

    const module = createProviderModule({ db: db as never })

    expect(module.service).toBe(mocks.service)
    expect(mocks.createProviderStore).toHaveBeenCalledWith(db)
    expect(mocks.createSecretCodec).toHaveBeenCalled()
    expect(mocks.createProviderService).toHaveBeenCalledWith(mocks.store, mocks.codec)
    expect(mocks.logger.info).toHaveBeenCalledWith('initialized')

    module.registerIpc(ipcMain as never)
    module.registerIpc(ipcMain as never)
    expect(mocks.registerProviderIpc).toHaveBeenCalledTimes(2)
    expect(mocks.registerProviderIpc).toHaveBeenLastCalledWith(ipcMain, mocks.service)
    expect(mocks.unregister).toHaveBeenCalledTimes(1)

    module.close()
    expect(mocks.unregister).toHaveBeenCalledTimes(2)
    expect(mocks.logger.info).toHaveBeenCalledWith('closed')
  })
})
