import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ChangeEntry } from '@shared/change-set'

const GIT_TIMEOUT_MS = 30_000
const GIT_MAX_BUFFER = 64 * 1024 * 1024
const VERSION_AUTHOR_ENV = {
  GIT_AUTHOR_NAME: 'Tanzo',
  GIT_AUTHOR_EMAIL: 'tanzo@local',
  GIT_COMMITTER_NAME: 'Tanzo',
  GIT_COMMITTER_EMAIL: 'tanzo@local'
}

export interface GitExecOptions {
  readonly cwd: string
  readonly env?: Record<string, string | undefined>
  readonly maxBuffer?: number
}

export interface RepoHandle {
  readonly workTree: string
  readonly gitDir: string
  readonly commonDir?: string
}

export interface CapturedCheckpoint {
  readonly id: string
  readonly kind: 'before' | 'after'
  readonly commitOid: string
  readonly treeOid: string
  readonly refName: string
}

interface ParsedNumstatEntry {
  readonly path: string
  readonly oldPath?: string
  readonly additions: number
  readonly deletions: number
  readonly binary: boolean
}

interface ParsedNameStatusEntry {
  readonly path: string
  readonly oldPath?: string
  readonly kind: ChangeEntry['kind']
}

export function execGit(
  args: readonly string[],
  options: GitExecOptions
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', ...args],
      {
        cwd: options.cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_EDITOR: 'true',
          GIT_MERGE_AUTOEDIT: 'no',
          ...options.env
        },
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: options.maxBuffer ?? GIT_MAX_BUFFER
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }))
          return
        }
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '' })
      }
    )
  })
}

export function buildScopedEnv(
  repo: RepoHandle,
  indexFile?: string
): Record<string, string | undefined> {
  return {
    GIT_DIR: repo.gitDir,
    GIT_WORK_TREE: repo.workTree,
    ...(repo.commonDir ? { GIT_COMMON_DIR: repo.commonDir } : {}),
    ...(indexFile ? { GIT_INDEX_FILE: indexFile } : {})
  }
}

export function checkpointRefName(runId: string, kind: 'before' | 'after'): string {
  return `refs/tanzo/runs/${runId}/${kind}`
}

export function normalizeGitPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '')
}

export function assertSafeRelativePath(filePath: string): string {
  const normalized = normalizeGitPath(filePath)
  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('/') ||
    normalized.includes('//') ||
    filePath.includes('\0')
  ) {
    throw new Error(`Change-set path "${filePath}" is not safe.`)
  }
  if (normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Change-set path "${filePath}" cannot escape the workspace.`)
  }
  return normalized
}

export function collectPaths(files: readonly ChangeEntry[]): string[] {
  return [
    ...new Set(
      files.flatMap((file) =>
        [file.path, file.oldPath].filter((value): value is string => Boolean(value))
      )
    )
  ]
}

export function pathsIntersect(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left)
  return right.some((entry) => leftSet.has(entry))
}

function mapStatusCode(code: string): ChangeEntry['kind'] {
  if (code === 'A') return 'added'
  if (code === 'D') return 'deleted'
  if (code === 'R') return 'renamed'
  if (code === 'C') return 'copied'
  return 'modified'
}

function parseIntSafe(input: string): number {
  const parsed = Number.parseInt(input, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseNumstat(output: string): ParsedNumstatEntry[] {
  const entries: ParsedNumstatEntry[] = []
  const tokens = output.split('\0').filter((token) => token.length > 0)
  for (let index = 0; index < tokens.length; index += 1) {
    const header = tokens[index] ?? ''
    const [additionsRaw = '0', deletionsRaw = '0', inlinePath] = header.split('\t')
    const binary = additionsRaw === '-' || deletionsRaw === '-'
    if (inlinePath !== undefined && inlinePath.length > 0) {
      entries.push({
        path: inlinePath,
        additions: binary ? 0 : parseIntSafe(additionsRaw),
        deletions: binary ? 0 : parseIntSafe(deletionsRaw),
        binary
      })
      continue
    }
    const oldPath = tokens[index + 1]
    const newPath = tokens[index + 2]
    if (!oldPath || !newPath) continue
    index += 2
    entries.push({
      path: newPath,
      oldPath,
      additions: binary ? 0 : parseIntSafe(additionsRaw),
      deletions: binary ? 0 : parseIntSafe(deletionsRaw),
      binary
    })
  }
  return entries
}

function parseNameStatus(output: string): ParsedNameStatusEntry[] {
  const entries: ParsedNameStatusEntry[] = []
  const tokens = output.split('\0').filter((token) => token.length > 0)
  for (let index = 0; index < tokens.length; index += 1) {
    const code = (tokens[index] ?? '').charAt(0)
    if (code === 'R' || code === 'C') {
      const oldPath = tokens[index + 1]
      const newPath = tokens[index + 2]
      if (oldPath && newPath) {
        entries.push({ path: newPath, oldPath, kind: code === 'R' ? 'renamed' : 'copied' })
      }
      index += 2
      continue
    }
    const filePath = tokens[index + 1]
    if (filePath) entries.push({ path: filePath, kind: mapStatusCode(code) })
    index += 1
  }
  return entries
}

export function parseChangeEntries(input: {
  readonly numstatOutput: string
  readonly nameStatusOutput: string
}): ChangeEntry[] {
  const numstatByPath = new Map<string, ParsedNumstatEntry>()
  const nameStatusByPath = new Map<string, ParsedNameStatusEntry>()
  for (const entry of parseNumstat(input.numstatOutput)) numstatByPath.set(entry.path, entry)
  for (const entry of parseNameStatus(input.nameStatusOutput))
    nameStatusByPath.set(entry.path, entry)
  const paths = new Set<string>([...numstatByPath.keys(), ...nameStatusByPath.keys()])
  return [...paths]
    .flatMap((filePath): ChangeEntry[] => {
      if (!filePath) return []
      const status = nameStatusByPath.get(filePath)
      const stats =
        numstatByPath.get(filePath) ??
        (status?.oldPath ? numstatByPath.get(status.oldPath) : undefined)
      const binary = stats?.binary ?? false
      const oldPath = status?.oldPath ?? stats?.oldPath
      return [
        {
          path: filePath,
          kind: binary ? 'binary' : (status?.kind ?? 'modified'),
          additions: stats?.additions ?? 0,
          deletions: stats?.deletions ?? 0,
          ...(oldPath ? { oldPath } : {}),
          ...(binary ? { binary: true } : {}),
          patchAvailable: !binary
        }
      ]
    })
    .sort((left, right) => left.path.localeCompare(right.path))
}

export async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await fs.access(inputPath)
    return true
  } catch {
    return false
  }
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${randomUUID()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(tempPath, filePath)
}

export async function resolveRepo(cwd: string): Promise<RepoHandle | null> {
  try {
    const inside = (await execGit(['rev-parse', '--is-inside-work-tree'], { cwd })).stdout.trim()
    if (inside !== 'true') return null
    const workTree = (await execGit(['rev-parse', '--show-toplevel'], { cwd })).stdout.trim()
    const gitDirRaw = (await execGit(['rev-parse', '--git-dir'], { cwd: workTree })).stdout.trim()
    const commonDirRaw = (
      await execGit(['rev-parse', '--git-common-dir'], { cwd: workTree })
    ).stdout.trim()
    const gitDir = path.isAbsolute(gitDirRaw) ? gitDirRaw : path.resolve(workTree, gitDirRaw)
    const commonDir = commonDirRaw
      ? path.isAbsolute(commonDirRaw)
        ? commonDirRaw
        : path.resolve(workTree, commonDirRaw)
      : undefined
    return {
      workTree,
      gitDir,
      ...(commonDir && commonDir !== gitDir ? { commonDir } : {})
    }
  } catch {
    return null
  }
}

export async function captureCheckpoint(input: {
  readonly repo: RepoHandle
  readonly runId: string
  readonly kind: 'before' | 'after'
  readonly label: string
  readonly parentCommitOid?: string
}): Promise<CapturedCheckpoint> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tanzo-change-set-'))
  const indexFile = path.join(tempDir, 'index')
  const refName = checkpointRefName(input.runId, input.kind)
  try {
    const env = buildScopedEnv(input.repo, indexFile)
    await execGit(['read-tree', '--empty'], { cwd: input.repo.workTree, env })
    await execGit(['add', '-A', '--', '.'], {
      cwd: input.repo.workTree,
      env,
      maxBuffer: GIT_MAX_BUFFER
    })
    const treeOid = (await execGit(['write-tree'], { cwd: input.repo.workTree, env })).stdout.trim()
    const commitArgs = [
      'commit-tree',
      treeOid,
      '-m',
      `Tanzo checkpoint ${input.label} (${refName})`
    ]
    if (input.parentCommitOid) commitArgs.push('-p', input.parentCommitOid)
    const commitOid = (
      await execGit(commitArgs, {
        cwd: input.repo.workTree,
        env: { ...env, ...VERSION_AUTHOR_ENV }
      })
    ).stdout.trim()
    await execGit(['update-ref', refName, commitOid], { cwd: input.repo.workTree, env })
    return { id: `${input.runId}:${input.kind}`, kind: input.kind, commitOid, treeOid, refName }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function captureCurrentTree(repo: RepoHandle): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tanzo-change-set-current-'))
  const indexFile = path.join(tempDir, 'index')
  try {
    const env = buildScopedEnv(repo, indexFile)
    await execGit(['read-tree', '--empty'], { cwd: repo.workTree, env })
    await execGit(['add', '-A', '--', '.'], { cwd: repo.workTree, env, maxBuffer: GIT_MAX_BUFFER })
    return (await execGit(['write-tree'], { cwd: repo.workTree, env })).stdout.trim()
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function computeEntries(
  repo: RepoHandle,
  beforeTreeOid: string,
  afterTreeOid: string
): Promise<ChangeEntry[]> {
  if (beforeTreeOid === afterTreeOid) return []
  const env = buildScopedEnv(repo)
  const [nameStatus, numstat] = await Promise.all([
    execGit(['diff-tree', '--name-status', '-z', '-r', '-M', '-C', beforeTreeOid, afterTreeOid], {
      cwd: repo.workTree,
      env
    }),
    execGit(['diff-tree', '--numstat', '-z', '-r', '-M', '-C', beforeTreeOid, afterTreeOid], {
      cwd: repo.workTree,
      env,
      maxBuffer: GIT_MAX_BUFFER
    })
  ])
  return parseChangeEntries({
    numstatOutput: numstat.stdout,
    nameStatusOutput: nameStatus.stdout
  })
}

export async function getTreeBlobMap(
  repo: RepoHandle,
  treeOid: string,
  paths: readonly string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  const safePaths = [...new Set(paths.map(assertSafeRelativePath))]
  for (const entry of safePaths) result.set(entry, null)
  if (safePaths.length === 0) return result
  const output = await execGit(['ls-tree', '-r', '-z', treeOid, '--', ...safePaths], {
    cwd: repo.workTree,
    env: buildScopedEnv(repo),
    maxBuffer: GIT_MAX_BUFFER
  })
  for (const raw of output.stdout.split('\0').filter(Boolean)) {
    const match = raw.match(/^[0-9]{6} [^ ]+ ([0-9a-f]{40,64})\t(.+)$/)
    if (match?.[1] && match[2]) result.set(match[2], match[1])
  }
  return result
}

export async function restorePathsToTree(input: {
  readonly repo: RepoHandle
  readonly treeOid: string
  readonly paths: readonly string[]
}): Promise<void> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tanzo-change-set-restore-'))
  const indexFile = path.join(tempDir, 'index')
  try {
    const env = buildScopedEnv(input.repo, indexFile)
    const targetPaths = [...new Set(input.paths.map(assertSafeRelativePath))]
    await execGit(['read-tree', input.treeOid], { cwd: input.repo.workTree, env })
    const lsTree = await execGit(
      ['ls-tree', '-r', '--name-only', input.treeOid, '--', ...targetPaths],
      { cwd: input.repo.workTree, env, maxBuffer: GIT_MAX_BUFFER }
    )
    const presentPaths = new Set(lsTree.stdout.trim().split('\n').filter(Boolean))
    const checkoutPaths = targetPaths.filter((entry) => presentPaths.has(entry))
    if (checkoutPaths.length > 0) {
      await execGit(['checkout-index', '-f', '--', ...checkoutPaths], {
        cwd: input.repo.workTree,
        env,
        maxBuffer: GIT_MAX_BUFFER
      })
    }
    for (const filePath of targetPaths) {
      if (presentPaths.has(filePath)) continue
      const absolutePath = path.resolve(input.repo.workTree, filePath)
      const relative = path.relative(input.repo.workTree, absolutePath)
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        await fs.rm(absolutePath, { recursive: true, force: true }).catch(() => undefined)
      }
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
