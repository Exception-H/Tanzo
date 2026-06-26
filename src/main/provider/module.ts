import type { IpcMain } from 'electron'
import { createLogger } from '../logger'
import type { SqlDatabase } from '../database/types'
import { registerProviderIpc } from './ipc'
import { createSecretCodec } from './secret'
import { createProviderService, type ProviderService } from './service'
import { createProviderStore, type ProviderStore } from './store'

const log = createLogger('provider.module')

export interface CreateProviderModuleOptions {
  db: SqlDatabase
}

export interface ProviderModule {
  service: ProviderService
  registerIpc(ipcMain: IpcMain): void
  close(): void
}

export function createProviderModule(options: CreateProviderModuleOptions): ProviderModule {
  const store: ProviderStore = createProviderStore(options.db)
  const service = createProviderService(store, createSecretCodec())
  let unregisterIpc: (() => void) | null = null

  log.info('initialized')

  return {
    service,
    registerIpc(ipcMain) {
      unregisterIpc?.()
      unregisterIpc = registerProviderIpc(ipcMain, service)
    },
    close() {
      unregisterIpc?.()
      unregisterIpc = null
      log.info('closed')
    }
  }
}
