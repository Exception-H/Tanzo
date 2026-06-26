import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type {
  ChangePreviewData,
  ChangeSetApplyInput,
  ChangeSetApplyResult
} from '@shared/change-set'
import {
  atomicWriteJson,
  assertSafeRelativePath,
  buildScopedEnv,
  captureCheckpoint,
  captureCurrentTree,
  collectPaths,
  computeEntries,
  execGit,
  getTreeBlobMap,
  pathExists,
  pathsIntersect,
  resolveRepo,
  restorePathsToTree,
  type CapturedCheckpoint,
  type RepoHandle
} from './change-set-git'

const CHANGE_SET_STORE_VERSION = 1
const GIT_MAX_BUFFER = 64 * 1024 * 1024

interface ChangeSetRecord {
  readonly preview: ChangePreviewData
  readonly repoRootPath: string
  readonly gitDir: string
  readonly commonDir?: string
  readonly beforeCommitOid: string
  readonly afterCommitOid: string
}

interface PendingRunCapture {
  readonly runId: string
  readonly chatId: string
  readonly assistantMessageId: string
  readonly cwd: string
  readonly repo: RepoHandle
  readonly before: CapturedCheckpoint
}

interface ChangeSetStoreState {
  readonly version: number
  readonly changeSets: readonly ChangeSetRecord[]
}

export interface CaptureRunInput {
  readonly runId: string
  readonly chatId: string
  readonly assistantMessageId: string
  readonly cwd: string
}

export interface ChangeSetService {
  captureBeforeRun(input: CaptureRunInput): Promise<void>
  captureAfterRun(input: CaptureRunInput): Promise<ChangePreviewData | null>
  getChangeSetFilePatch(changeSetId: string, filePath: string): Promise<string | null>
  applyChangeSet(input: ChangeSetApplyInput): Promise<ChangeSetApplyResult>
  discard(runId: string): void
}

export interface ChangeSetServiceOptions {
  readonly userDataPath: string
}

function repoOf(record: ChangeSetRecord): RepoHandle {
  return {
    workTree: record.repoRootPath,
    gitDir: record.gitDir,
    ...(record.commonDir ? { commonDir: record.commonDir } : {})
  }
}

function changeSetCompare(left: ChangeSetRecord, right: ChangeSetRecord): number {
  const createdDelta = right.preview.createdAt.localeCompare(left.preview.createdAt)
  return createdDelta !== 0
    ? createdDelta
    : right.preview.changeSetId.localeCompare(left.preview.changeSetId)
}

export function createChangeSetService(options: ChangeSetServiceOptions): ChangeSetService {
  const storePath = path.join(options.userDataPath, 'workspace-change-sets.json')
  const pending = new Map<string, PendingRunCapture>()
  let statePromise: Promise<ChangeSetStoreState> | null = null
  let writeLock: Promise<unknown> = Promise.resolve()

  async function readState(): Promise<ChangeSetStoreState> {
    if (!(await pathExists(storePath))) {
      return { version: CHANGE_SET_STORE_VERSION, changeSets: [] }
    }
    try {
      const { readFile } = await import('node:fs/promises')
      const parsed = JSON.parse(await readFile(storePath, 'utf8')) as Partial<ChangeSetStoreState>
      return {
        version: CHANGE_SET_STORE_VERSION,
        changeSets: Array.isArray(parsed.changeSets) ? (parsed.changeSets as ChangeSetRecord[]) : []
      }
    } catch {
      return { version: CHANGE_SET_STORE_VERSION, changeSets: [] }
    }
  }

  async function loadState(): Promise<ChangeSetStoreState> {
    statePromise ??= readState()
    return statePromise
  }

  async function updateState(
    updater: (state: ChangeSetStoreState) => ChangeSetStoreState
  ): Promise<ChangeSetStoreState> {
    const nextWrite = writeLock.then(async () => {
      const current = await loadState()
      const next = updater(current)
      await atomicWriteJson(storePath, next)
      statePromise = Promise.resolve(next)
      return next
    })
    writeLock = nextWrite.catch(() => undefined)
    return nextWrite
  }

  async function upsertRecord(record: ChangeSetRecord): Promise<void> {
    await updateState((state) => ({
      version: CHANGE_SET_STORE_VERSION,
      changeSets: [
        record,
        ...state.changeSets.filter(
          (candidate) => candidate.preview.changeSetId !== record.preview.changeSetId
        )
      ]
        .sort(changeSetCompare)
        .slice(0, 500)
    }))
  }

  async function findRecord(changeSetId: string): Promise<ChangeSetRecord | null> {
    const state = await loadState()
    return state.changeSets.find((record) => record.preview.changeSetId === changeSetId) ?? null
  }

  async function materializePreview(record: ChangeSetRecord): Promise<ChangePreviewData> {
    const repo = repoOf(record)
    let materialization: ChangePreviewData['materialization'] = { status: 'unknown' }
    let restoreRisk: ChangePreviewData['restoreRisk'] = { code: 'none' }

    try {
      const currentTreeOid = await captureCurrentTree(repo)
      const allPaths = collectPaths(record.preview.files)
      const [beforeMap, afterMap, currentMap] = await Promise.all([
        getTreeBlobMap(repo, record.preview.beforeTreeOid, allPaths),
        getTreeBlobMap(repo, record.preview.afterTreeOid, allPaths),
        getTreeBlobMap(repo, currentTreeOid, allPaths)
      ])
      let hasApplied = false
      let hasReverted = false
      let hasDiverged = false
      for (const entry of allPaths) {
        const beforeBlob = beforeMap.get(entry) ?? null
        const afterBlob = afterMap.get(entry) ?? null
        const currentBlob = currentMap.get(entry) ?? null
        if (currentBlob === beforeBlob && currentBlob === afterBlob) continue
        if (currentBlob === afterBlob) {
          hasApplied = true
          continue
        }
        if (currentBlob === beforeBlob) {
          hasReverted = true
          continue
        }
        hasDiverged = true
        break
      }
      if (hasDiverged) materialization = { status: 'failed' }
      else if (hasApplied && hasReverted) materialization = { status: 'partial' }
      else if (hasApplied || currentTreeOid === record.preview.afterTreeOid)
        materialization = { status: 'materialized' }
      else if (hasReverted || currentTreeOid === record.preview.beforeTreeOid)
        materialization = { status: 'skipped' }
      else materialization = { status: 'partial' }
    } catch {
      materialization = { status: 'unknown' }
      restoreRisk = { code: 'low', message: 'The original execution target is unavailable.' }
    }

    if (materialization.status === 'failed') {
      restoreRisk = { code: 'blocked', message: 'The workspace has diverged from this change.' }
    } else if (restoreRisk.code === 'none') {
      const state = await loadState()
      const pathSet = collectPaths(record.preview.files)
      const newer = state.changeSets.filter(
        (candidate) =>
          candidate.preview.changeSetId !== record.preview.changeSetId &&
          candidate.preview.cwd === record.preview.cwd &&
          candidate.preview.createdAt > record.preview.createdAt &&
          pathsIntersect(pathSet, collectPaths(candidate.preview.files))
      )
      if (newer.some((candidate) => candidate.preview.chatId !== record.preview.chatId)) {
        restoreRisk = {
          code: 'high',
          message: 'A newer change from another conversation touches the same paths.'
        }
      } else if (newer.length > 0) {
        restoreRisk = {
          code: 'medium',
          message: 'A newer change in this conversation touches the same paths.'
        }
      }
    }

    return { ...record.preview, materialization, restoreRisk }
  }

  return {
    async captureBeforeRun(input) {
      const repo = await resolveRepo(input.cwd)
      if (!repo) return
      const before = await captureCheckpoint({
        repo,
        runId: input.runId,
        kind: 'before',
        label: input.chatId
      })
      pending.set(input.runId, {
        runId: input.runId,
        chatId: input.chatId,
        assistantMessageId: input.assistantMessageId,
        cwd: input.cwd,
        repo,
        before
      })
    },

    async captureAfterRun(input) {
      const previous = pending.get(input.runId)
      if (!previous) return null
      pending.delete(input.runId)

      const after = await captureCheckpoint({
        repo: previous.repo,
        runId: input.runId,
        kind: 'after',
        label: previous.chatId,
        parentCommitOid: previous.before.commitOid
      })
      if (after.treeOid === previous.before.treeOid) return null

      const files = await computeEntries(previous.repo, previous.before.treeOid, after.treeOid)
      if (files.length === 0) return null

      const additions = files.reduce((total, file) => total + file.additions, 0)
      const deletions = files.reduce((total, file) => total + file.deletions, 0)
      const preview: ChangePreviewData = {
        changeSetId: randomUUID(),
        runId: input.runId,
        chatId: previous.chatId,
        assistantMessageId: input.assistantMessageId,
        cwd: previous.cwd,
        beforeCheckpointId: previous.before.id,
        afterCheckpointId: after.id,
        beforeTreeOid: previous.before.treeOid,
        afterTreeOid: after.treeOid,
        files,
        fileCount: files.length,
        additions,
        deletions,
        materialization: { status: 'materialized' },
        restoreRisk: { code: 'none' },
        createdAt: new Date().toISOString()
      }
      const record: ChangeSetRecord = {
        preview,
        repoRootPath: previous.repo.workTree,
        gitDir: previous.repo.gitDir,
        ...(previous.repo.commonDir ? { commonDir: previous.repo.commonDir } : {}),
        beforeCommitOid: previous.before.commitOid,
        afterCommitOid: after.commitOid
      }
      await upsertRecord(record)
      return materializePreview(record)
    },

    async getChangeSetFilePatch(changeSetId, filePath) {
      const record = await findRecord(changeSetId)
      if (!record) return null
      const file = record.preview.files.find(
        (entry) => entry.path === filePath || entry.oldPath === filePath
      )
      if (!file || file.binary || !file.patchAvailable) return null
      const paths = [file.path, file.oldPath].filter((entry): entry is string => Boolean(entry))
      const patch = await execGit(
        [
          'diff-tree',
          '-p',
          '-r',
          '--binary',
          '-M',
          '-C',
          record.beforeCommitOid,
          record.afterCommitOid,
          '--',
          ...paths
        ],
        { cwd: record.repoRootPath, env: buildScopedEnv(repoOf(record)), maxBuffer: GIT_MAX_BUFFER }
      )
      return patch.stdout.trim().length > 0 ? patch.stdout : null
    },

    async applyChangeSet(input) {
      const record = await findRecord(input.changeSetId)
      if (!record) throw new Error(`Change set "${input.changeSetId}" was not found.`)
      const currentPreview = await materializePreview(record)
      if (
        !input.force &&
        (currentPreview.restoreRisk.code === 'blocked' ||
          currentPreview.restoreRisk.code === 'high' ||
          currentPreview.restoreRisk.code === 'low')
      ) {
        throw new Error(currentPreview.restoreRisk.message ?? 'Change set apply is blocked.')
      }
      const targetTreeOid =
        input.targetState === 'before' ? record.preview.beforeTreeOid : record.preview.afterTreeOid
      const allowedPaths = new Set(collectPaths(record.preview.files))
      const paths =
        input.paths && input.paths.length > 0
          ? [...new Set(input.paths.map(assertSafeRelativePath))]
          : [...allowedPaths]
      const invalidPath = paths.find((entry) => !allowedPaths.has(entry))
      if (invalidPath) {
        throw new Error(`Change-set path "${invalidPath}" is not part of this change set.`)
      }
      await restorePathsToTree({ repo: repoOf(record), treeOid: targetTreeOid, paths })
      const refreshed = await materializePreview(record)
      await upsertRecord({ ...record, preview: refreshed })
      return { changeSet: refreshed }
    },

    discard(runId) {
      pending.delete(runId)
    }
  }
}
