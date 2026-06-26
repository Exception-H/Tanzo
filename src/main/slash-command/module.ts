import { join } from 'node:path'
import { app, type IpcMain } from 'electron'
import { createLogger } from '../logger'
import type { SkillsStore } from '../agent/skills/types'
import { registerSlashCommandIpc } from './ipc'
import { createSlashCommandService, type SlashCommandService } from './service'
import { createSlashCommandStore } from './store'

export interface SlashCommandModule {
  service: SlashCommandService
  registerIpc(ipcMain: IpcMain): void
  close(): void
}

export function createSlashCommandModule(options: { skills: SkillsStore }): SlashCommandModule {
  const logger = createLogger('slash-command.module')
  const store = createSlashCommandStore({
    userDir: join(app.getPath('userData'), 'agent'),
    logger
  })
  const service = createSlashCommandService(store, options.skills)

  let unregisterIpc: (() => void) | null = null

  return {
    service,
    registerIpc(ipcMain) {
      unregisterIpc?.()
      unregisterIpc = registerSlashCommandIpc(ipcMain, service)
    },
    close() {
      unregisterIpc?.()
      unregisterIpc = null
      logger.info('closed')
    }
  }
}
