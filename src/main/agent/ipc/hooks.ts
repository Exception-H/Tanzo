import { z } from 'zod'
import { HOOKS_CHANNELS } from '@shared/hooks'
import { optionalChatId } from './schemas'
import type { AgentIpcDeps, IpcRegistration } from './types'

const keySchema = z.string().min(1).max(2000)
const hashSchema = z.string().min(1).max(200)

export function hooksHandlers(deps: AgentIpcDeps): IpcRegistration[] {
  return [
    [HOOKS_CHANNELS.list, (workspaceId) => deps.hooks.list(optionalChatId(workspaceId))],
    [HOOKS_CHANNELS.reload, () => deps.hooks.reload()],
    [
      HOOKS_CHANNELS.setEnabled,
      (key, enabled, workspaceId) =>
        deps.hooks.setEnabled(
          keySchema.parse(key),
          z.boolean().parse(enabled),
          optionalChatId(workspaceId)
        )
    ],
    [
      HOOKS_CHANNELS.setTrusted,
      (key, contentHash, workspaceId) =>
        deps.hooks.setTrusted(
          keySchema.parse(key),
          hashSchema.parse(contentHash),
          optionalChatId(workspaceId)
        )
    ],
    [HOOKS_CHANNELS.preview, (key) => deps.hooks.preview(keySchema.parse(key))]
  ]
}
