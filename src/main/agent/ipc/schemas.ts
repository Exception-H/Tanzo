import { z } from 'zod'

export const chatIdSchema = z.string().trim().min(1)
export const permissionModeSchema = z.enum(['default', 'plan', 'yolo', 'dangerous'])
export const agentKindSchema = z.enum(['main', 'subagent'])
export const approvalScopeSchema = z.enum(['once', 'session', 'forever'])

export function optionalChatId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return chatIdSchema.parse(value)
}

export const activityRangeSchema = z
  .object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative()
  })
  .refine((value) => value.from <= value.to, { message: 'from must be <= to' })

export const activityRunPageSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0)
})

export const gitCwdSchema = z.string().trim().min(1)
export const gitTargetSchema = z.object({ cwd: gitCwdSchema })
export const gitPathsSchema = z.object({
  cwd: gitCwdSchema,
  paths: z.array(z.string().min(1)).min(1)
})
export const gitDiffSchema = z.union([
  z.object({
    cwd: gitCwdSchema,
    scope: z.enum(['staged', 'unstaged']),
    filePath: z.string().min(1)
  }),
  z.object({
    cwd: gitCwdSchema,
    scope: z.literal('commit'),
    hash: z.string().min(1),
    filePath: z.string().min(1).optional()
  })
])
export const gitHistorySchema = z.object({
  cwd: gitCwdSchema,
  limit: z.number().int().min(1).max(500).optional()
})
export const gitCommitDetailSchema = z.object({ cwd: gitCwdSchema, hash: z.string().min(1) })
export const gitCommitSchema = z.object({
  cwd: gitCwdSchema,
  message: z.string().optional(),
  amend: z.boolean().optional(),
  noEdit: z.boolean().optional(),
  signoff: z.boolean().optional()
})
export const gitFetchSchema = z.object({ cwd: gitCwdSchema, remote: z.string().optional() })
export const gitPullSchema = z.object({
  cwd: gitCwdSchema,
  remote: z.string().optional(),
  branch: z.string().optional()
})
export const gitPushSchema = z.object({
  cwd: gitCwdSchema,
  remote: z.string().optional(),
  branch: z.string().optional(),
  forceWithLease: z.boolean().optional(),
  lease: z.string().optional()
})
export const gitCheckoutSchema = z.object({ cwd: gitCwdSchema, ref: z.string().min(1) })
export const gitCheckoutRemoteSchema = z.object({
  cwd: gitCwdSchema,
  remoteBranch: z.string().min(1),
  localBranch: z.string().optional()
})
export const gitCreateBranchSchema = z.object({
  cwd: gitCwdSchema,
  name: z.string().min(1),
  startPoint: z.string().optional()
})
export const gitDeleteBranchSchema = z.object({
  cwd: gitCwdSchema,
  name: z.string().min(1),
  force: z.boolean().optional()
})
export const gitAddRemoteSchema = z.object({
  cwd: gitCwdSchema,
  name: z.string().min(1),
  url: z.string().min(1),
  fetch: z.boolean().optional()
})
export const gitRemoveRemoteSchema = z.object({ cwd: gitCwdSchema, name: z.string().min(1) })
export const gitInitSchema = z.object({ cwd: gitCwdSchema, initialBranch: z.string().optional() })
export const gitSetUserSchema = z.object({
  cwd: gitCwdSchema,
  name: z.string().min(1),
  email: z.string().min(1),
  scope: z.enum(['local', 'global']).optional()
})
