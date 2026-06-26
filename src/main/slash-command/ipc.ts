import type { IpcMain } from 'electron'
import { z } from 'zod'
import { SLASH_COMMAND_CHANNELS } from '@shared/slash-command'
import { registerIpcHandlers, type IpcRegistration } from '../ipc/router'
import type { SlashCommandService } from './service'

const workspaceRootSchema = z.string().trim().min(1)

export function registerSlashCommandIpc(
  ipcMain: IpcMain,
  service: SlashCommandService
): () => void {
  const channels = [
    [
      SLASH_COMMAND_CHANNELS.list,
      (workspaceRoot: unknown) => service.listCommands(workspaceRootSchema.parse(workspaceRoot))
    ]
  ] as const

  return registerIpcHandlers(ipcMain, channels as readonly IpcRegistration[])
}
