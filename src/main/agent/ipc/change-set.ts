import { z } from 'zod'
import { CHANGE_SET_CHANNELS } from '@shared/change-set'
import type { AgentIpcDeps, IpcRegistration } from './types'

const changeSetIdSchema = z.string().trim().min(1)
const filePathSchema = z.string().trim().min(1)
const applyInputSchema = z.object({
  changeSetId: changeSetIdSchema,
  targetState: z.enum(['before', 'after']),
  paths: z.array(z.string().min(1)).optional(),
  force: z.boolean().optional()
})

export function changeSetHandlers(deps: AgentIpcDeps): IpcRegistration[] {
  return [
    [
      CHANGE_SET_CHANNELS.patch,
      (id, filePath) =>
        deps.changeSet.getChangeSetFilePatch(
          changeSetIdSchema.parse(id),
          filePathSchema.parse(filePath)
        )
    ],
    [
      CHANGE_SET_CHANNELS.apply,
      (input) => deps.changeSet.applyChangeSet(applyInputSchema.parse(input))
    ]
  ]
}
