import { GIT_CHANNELS } from '@shared/git'
import {
  gitAddRemoteSchema,
  gitCheckoutRemoteSchema,
  gitCheckoutSchema,
  gitCommitDetailSchema,
  gitCommitSchema,
  gitCreateBranchSchema,
  gitCwdSchema,
  gitDeleteBranchSchema,
  gitDiffSchema,
  gitFetchSchema,
  gitHistorySchema,
  gitInitSchema,
  gitPathsSchema,
  gitPullSchema,
  gitPushSchema,
  gitRemoveRemoteSchema,
  gitSetUserSchema,
  gitTargetSchema
} from './schemas'
import type { AgentIpcDeps, IpcRegistration } from './types'

export function gitHandlers(deps: AgentIpcDeps): IpcRegistration[] {
  return [
    [GIT_CHANNELS.overview, (input) => deps.git.getOverview(gitTargetSchema.parse(input).cwd)],
    [GIT_CHANNELS.status, (input) => deps.git.getStatus(gitTargetSchema.parse(input).cwd)],
    [GIT_CHANNELS.diff, (input) => deps.git.getDiff(gitDiffSchema.parse(input))],
    [
      GIT_CHANNELS.history,
      (input) => {
        const parsed = gitHistorySchema.parse(input)
        return deps.git.listHistory(parsed.cwd, parsed.limit)
      }
    ],
    [
      GIT_CHANNELS.commitDetail,
      (input) => {
        const parsed = gitCommitDetailSchema.parse(input)
        return deps.git.getCommit(parsed.cwd, parsed.hash)
      }
    ],
    [GIT_CHANNELS.branches, (input) => deps.git.listBranches(gitTargetSchema.parse(input).cwd)],
    [
      GIT_CHANNELS.remoteBranches,
      (input) => deps.git.listRemoteBranches(gitTargetSchema.parse(input).cwd)
    ],
    [GIT_CHANNELS.remotes, (input) => deps.git.listRemotes(gitTargetSchema.parse(input).cwd)],
    [GIT_CHANNELS.user, (input) => deps.git.getUser(gitTargetSchema.parse(input).cwd)],
    [GIT_CHANNELS.init, (input) => deps.git.init(gitInitSchema.parse(input))],
    [GIT_CHANNELS.stage, (input) => deps.git.stage(gitPathsSchema.parse(input))],
    [GIT_CHANNELS.restoreStaged, (input) => deps.git.restoreStaged(gitPathsSchema.parse(input))],
    [
      GIT_CHANNELS.restoreWorktree,
      (input) => deps.git.restoreWorktree(gitPathsSchema.parse(input))
    ],
    [GIT_CHANNELS.discard, (input) => deps.git.discard(gitPathsSchema.parse(input))],
    [GIT_CHANNELS.commit, (input) => deps.git.commit(gitCommitSchema.parse(input))],
    [GIT_CHANNELS.fetch, (input) => deps.git.fetch(gitFetchSchema.parse(input))],
    [GIT_CHANNELS.pull, (input) => deps.git.pull(gitPullSchema.parse(input))],
    [GIT_CHANNELS.push, (input) => deps.git.push(gitPushSchema.parse(input))],
    [GIT_CHANNELS.checkout, (input) => deps.git.checkout(gitCheckoutSchema.parse(input))],
    [
      GIT_CHANNELS.checkoutRemote,
      (input) => deps.git.checkoutRemoteBranch(gitCheckoutRemoteSchema.parse(input))
    ],
    [
      GIT_CHANNELS.createBranch,
      (input) => deps.git.createBranch(gitCreateBranchSchema.parse(input))
    ],
    [
      GIT_CHANNELS.deleteBranch,
      (input) => deps.git.deleteBranch(gitDeleteBranchSchema.parse(input))
    ],
    [GIT_CHANNELS.addRemote, (input) => deps.git.addRemote(gitAddRemoteSchema.parse(input))],
    [
      GIT_CHANNELS.removeRemote,
      (input) => deps.git.removeRemote(gitRemoveRemoteSchema.parse(input))
    ],
    [GIT_CHANNELS.setUser, (input) => deps.git.setUser(gitSetUserSchema.parse(input))],
    [GIT_CHANNELS.watch, (cwd) => deps.git.watch(gitCwdSchema.parse(cwd))],
    [GIT_CHANNELS.unwatch, (cwd) => deps.git.unwatch(gitCwdSchema.parse(cwd))]
  ]
}
