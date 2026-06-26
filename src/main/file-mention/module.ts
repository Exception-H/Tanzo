import { type IpcMain } from 'electron'
import { createLogger } from '../logger'
import { registerFileMentionIpc } from './ipc'
import { createFileMentionService, type FileMentionService } from './service'

export interface FileMentionModule {
  service: FileMentionService
  registerIpc(ipcMain: IpcMain): void
  close(): void
}

export function createFileMentionModule(): FileMentionModule {
  const logger = createLogger('file-mention.module')
  const service = createFileMentionService()

  let unregisterIpc: (() => void) | null = null

  return {
    service,
    registerIpc(ipcMain) {
      unregisterIpc?.()
      unregisterIpc = registerFileMentionIpc(ipcMain, service)
    },
    close() {
      unregisterIpc?.()
      unregisterIpc = null
      logger.info('closed')
    }
  }
}
