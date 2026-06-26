import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { gitClient } from '@/platform/electron/git-client'
import type { GitCommitInput, GitPushInput, GitTargetRef } from '@shared/git'
import { gitKeys } from './git-query-keys'

type GitMutationOptions<T> = Omit<T, 'cwd'>

export interface GitMutations {
  readonly mutating: boolean
  readonly error: string | null
  readonly clearError: () => void
  readonly refresh: () => Promise<void>
  readonly initRepository: (initialBranch?: string) => Promise<boolean>
  readonly stageFile: (path: string) => Promise<boolean>
  readonly stageFiles: (paths: readonly string[]) => Promise<boolean>
  readonly unstageFile: (path: string) => Promise<boolean>
  readonly unstageFiles: (paths: readonly string[]) => Promise<boolean>
  readonly restoreFile: (path: string) => Promise<boolean>
  readonly restoreFiles: (paths: readonly string[]) => Promise<boolean>
  readonly discardFile: (path: string) => Promise<boolean>
  readonly commit: (options?: GitMutationOptions<GitCommitInput>) => Promise<boolean>
  readonly fetch: (remote?: string) => Promise<boolean>
  readonly pull: (remote?: string, branch?: string) => Promise<boolean>
  readonly push: (options?: GitMutationOptions<GitPushInput>) => Promise<boolean>
  readonly checkoutBranch: (branch: string) => Promise<boolean>
  readonly checkoutRemoteBranch: (remoteBranch: string, localBranch?: string) => Promise<boolean>
  readonly createBranch: (name: string, startPoint?: string) => Promise<boolean>
  readonly deleteBranch: (name: string, force?: boolean) => Promise<boolean>
  readonly addRemote: (name: string, url: string, fetch?: boolean) => Promise<boolean>
  readonly removeRemote: (name: string) => Promise<boolean>
  readonly setUser: (name: string, email: string, scope?: 'local' | 'global') => Promise<boolean>
}

function summarizeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * All git write actions. Each runs the IPC call, then invalidates every query
 * scoped to the repository's cwd so React Query refetches the active views —
 * the cache-aware replacement for the controller's old manual `refresh()`.
 */
export function useGitMutations(
  target: GitTargetRef | null,
  commitMessage: string,
  onCommitted: () => void
): GitMutations {
  const queryClient = useQueryClient()
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cwd = target?.cwd ?? ''

  const refresh = useCallback(async () => {
    if (!cwd) return
    await queryClient.invalidateQueries({ queryKey: gitKeys.repo(cwd) })
  }, [cwd, queryClient])

  const runMutation = useCallback(
    async (action: () => Promise<unknown>, fallback: string): Promise<boolean> => {
      if (!target) return false
      setMutating(true)
      try {
        await action()
        await queryClient.invalidateQueries({ queryKey: gitKeys.repo(target.cwd) })
        setError(null)
        return true
      } catch (mutationError) {
        const message = summarizeError(mutationError, fallback)
        setError(message)
        toast.error(message)
        return false
      } finally {
        setMutating(false)
      }
    },
    [queryClient, target]
  )

  const initRepository = useCallback(
    (initialBranch?: string) =>
      runMutation(
        () =>
          gitClient.init({ ...(target as GitTargetRef), initialBranch: optional(initialBranch) }),
        i18n.t('gitReview.errors.initializeRepository')
      ),
    [runMutation, target]
  )

  const stageFile = useCallback(
    (path: string) =>
      runMutation(
        () => gitClient.stage({ ...(target as GitTargetRef), paths: [path] }),
        i18n.t('gitReview.errors.stageFile')
      ),
    [runMutation, target]
  )

  const stageFiles = useCallback(
    (paths: readonly string[]) =>
      paths.length === 0
        ? Promise.resolve(false)
        : runMutation(
            () => gitClient.stage({ ...(target as GitTargetRef), paths }),
            i18n.t('gitReview.errors.stageFiles')
          ),
    [runMutation, target]
  )

  const unstageFile = useCallback(
    (path: string) =>
      runMutation(
        () => gitClient.restoreStaged({ ...(target as GitTargetRef), paths: [path] }),
        i18n.t('gitReview.errors.unstageFile')
      ),
    [runMutation, target]
  )

  const unstageFiles = useCallback(
    (paths: readonly string[]) =>
      paths.length === 0
        ? Promise.resolve(false)
        : runMutation(
            () => gitClient.restoreStaged({ ...(target as GitTargetRef), paths }),
            i18n.t('gitReview.errors.unstageFiles')
          ),
    [runMutation, target]
  )

  const restoreFile = useCallback(
    (path: string) =>
      runMutation(
        () => gitClient.restoreWorktree({ ...(target as GitTargetRef), paths: [path] }),
        i18n.t('gitReview.errors.restoreFile')
      ),
    [runMutation, target]
  )

  const restoreFiles = useCallback(
    (paths: readonly string[]) =>
      paths.length === 0
        ? Promise.resolve(false)
        : runMutation(
            () => gitClient.restoreWorktree({ ...(target as GitTargetRef), paths }),
            i18n.t('gitReview.errors.restoreFiles')
          ),
    [runMutation, target]
  )

  const discardFile = useCallback(
    (path: string) =>
      runMutation(
        () => gitClient.discard({ ...(target as GitTargetRef), paths: [path] }),
        i18n.t('gitReview.errors.discardFile')
      ),
    [runMutation, target]
  )

  const commit = useCallback(
    (commitOptions: GitMutationOptions<GitCommitInput> = {}) => {
      if (!target) return Promise.resolve(false)
      const message = optional(commitOptions.message) ?? commitMessage.trim()
      if (!commitOptions.noEdit && !message) {
        toast.error(i18n.t('gitReview.errors.commitMessageRequired'))
        return Promise.resolve(false)
      }
      return runMutation(async () => {
        await gitClient.commit({ ...target, ...commitOptions, message })
        onCommitted()
      }, i18n.t('gitReview.errors.createCommit'))
    },
    [commitMessage, onCommitted, runMutation, target]
  )

  const fetch = useCallback(
    (remote?: string) =>
      runMutation(
        () => gitClient.fetch({ ...(target as GitTargetRef), remote: optional(remote) }),
        i18n.t('gitReview.errors.fetch')
      ),
    [runMutation, target]
  )

  const pull = useCallback(
    (remote?: string, branch?: string) =>
      runMutation(
        () =>
          gitClient.pull({
            ...(target as GitTargetRef),
            remote: optional(remote),
            branch: optional(branch)
          }),
        i18n.t('gitReview.errors.pull')
      ),
    [runMutation, target]
  )

  const push = useCallback(
    (pushOptions: GitMutationOptions<GitPushInput> = {}) =>
      runMutation(
        () =>
          gitClient.push({
            ...(target as GitTargetRef),
            ...pushOptions,
            remote: optional(pushOptions.remote),
            branch: optional(pushOptions.branch),
            lease: optional(pushOptions.lease)
          }),
        i18n.t('gitReview.errors.push')
      ),
    [runMutation, target]
  )

  const checkoutBranch = useCallback(
    (branch: string) =>
      runMutation(
        () => gitClient.checkout({ ...(target as GitTargetRef), ref: branch }),
        i18n.t('gitReview.errors.checkoutBranch')
      ),
    [runMutation, target]
  )

  const checkoutRemoteBranch = useCallback(
    (remoteBranch: string, localBranch?: string) =>
      runMutation(
        () =>
          gitClient.checkoutRemoteBranch({
            ...(target as GitTargetRef),
            remoteBranch,
            localBranch: optional(localBranch)
          }),
        i18n.t('gitReview.errors.checkoutRemoteBranch')
      ),
    [runMutation, target]
  )

  const createBranch = useCallback(
    (name: string, startPoint?: string) => {
      const branchName = name.trim()
      if (!branchName) {
        toast.error(i18n.t('gitReview.errors.branchNameRequired'))
        return Promise.resolve(false)
      }
      return runMutation(
        () =>
          gitClient.createBranch({
            ...(target as GitTargetRef),
            name: branchName,
            startPoint: optional(startPoint)
          }),
        i18n.t('gitReview.errors.createBranch')
      )
    },
    [runMutation, target]
  )

  const deleteBranch = useCallback(
    (name: string, force?: boolean) =>
      runMutation(
        () => gitClient.deleteBranch({ ...(target as GitTargetRef), name, force }),
        i18n.t('gitReview.errors.deleteBranch')
      ),
    [runMutation, target]
  )

  const addRemote = useCallback(
    (name: string, url: string, fetchRemote?: boolean) =>
      runMutation(
        () =>
          gitClient.addRemote({
            ...(target as GitTargetRef),
            name: name.trim(),
            url: url.trim(),
            fetch: fetchRemote
          }),
        i18n.t('gitReview.errors.addRemote')
      ),
    [runMutation, target]
  )

  const removeRemote = useCallback(
    (name: string) =>
      runMutation(
        () => gitClient.removeRemote({ ...(target as GitTargetRef), name }),
        i18n.t('gitReview.errors.removeRemote')
      ),
    [runMutation, target]
  )

  const setUser = useCallback(
    (name: string, email: string, scope?: 'local' | 'global') =>
      runMutation(
        () =>
          gitClient.setUser({
            ...(target as GitTargetRef),
            name: name.trim(),
            email: email.trim(),
            scope
          }),
        i18n.t('gitReview.errors.saveIdentity')
      ),
    [runMutation, target]
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    mutating,
    error,
    clearError,
    refresh,
    initRepository,
    stageFile,
    stageFiles,
    unstageFile,
    unstageFiles,
    restoreFile,
    restoreFiles,
    discardFile,
    commit,
    fetch,
    pull,
    push,
    checkoutBranch,
    checkoutRemoteBranch,
    createBranch,
    deleteBranch,
    addRemote,
    removeRemote,
    setUser
  }
}
