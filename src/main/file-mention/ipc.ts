import type { IpcMain } from 'electron'
import { z } from 'zod'
import { FILE_MENTION_CHANNELS } from '@shared/file-mention'
import { registerIpcHandlers } from '../ipc/router'
import type { FileMentionService } from './service'

const workspaceRootSchema = z.string().trim().min(1)
const querySchema = z.string()

export function registerFileMentionIpc(ipcMain: IpcMain, service: FileMentionService): () => void {
  return registerIpcHandlers(ipcMain, [
    [
      FILE_MENTION_CHANNELS.search,
      (workspaceRoot: unknown, query: unknown) =>
        service.search(workspaceRootSchema.parse(workspaceRoot), querySchema.parse(query))
    ]
  ])
}
