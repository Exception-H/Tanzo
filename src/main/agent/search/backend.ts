import { spawn, execFileSync } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { TanzoValidationError } from '@shared/errors'
import type {
  GlobOptions,
  GrepMatch,
  GrepQuery,
  GrepResult,
  SearchBackend,
  SearchBackendOptions
} from './types'
import { resolveRipgrepPath } from './ripgrep'
import {
  assertNonGitPath,
  assertNonSensitivePath,
  SENSITIVE_RIPGREP_EXCLUDES
} from '../security/path-safety'

const DEFAULT_GLOB_LIMIT = 100
const DEFAULT_HEAD = 50
const MAX_COLUMNS = 500
const GIT_EXCLUDE = '!**/.git/**'
const MAX_RG_OUTPUT_BYTES = 16 * 1024 * 1024
const RG_TIMEOUT_MS = 30_000

let validTypes: Set<string> | null = null
function loadValidTypes(): Set<string> {
  if (validTypes) return validTypes
  try {
    const out = execFileSync(resolveRipgrepPath(), ['--type-list'], { encoding: 'utf8' })
    validTypes = new Set(
      out
        .split('\n')
        .map((line) => line.split(':')[0]?.trim())
        .filter((name): name is string => Boolean(name))
    )
  } catch {
    validTypes = new Set()
  }
  return validTypes
}

function assertValidType(type: string): void {
  const types = loadValidTypes()

  if (types.size > 0 && !types.has(type)) {
    throw new TanzoValidationError(
      'GREP_INVALID_TYPE',
      `Unknown file type "${type}". The "type" filter expects a ripgrep language type ` +
        `(e.g. ts, js, py, md, rust) — not "file". Omit "type" to search all files, ` +
        `or use "glob" (e.g. "*.ts") to match by extension.`,
      { recoverable: true }
    )
  }
}

function runRg(args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(resolveRipgrepPath(), args, {
      cwd,
      signal,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let stdoutBytes = 0
    let capped = false
    const timer = setTimeout(() => {
      capped = true
      child.kill('SIGKILL')
    }, RG_TIMEOUT_MS)
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (data: string) => {
      if (capped) return
      stdoutBytes += Buffer.byteLength(data)
      stdout += data
      if (stdoutBytes >= MAX_RG_OUTPUT_BYTES) {
        capped = true
        child.kill('SIGKILL')
      }
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (data: string) => {
      if (stderr.length < 4096) stderr += data
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      if (capped) {
        resolvePromise(stdout)
        return
      }
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (capped) {
        resolvePromise(stdout)
        return
      }
      if (code !== null && code >= 2) {
        reject(new Error(stderr.trim() || `ripgrep exited with code ${code}`))
        return
      }
      resolvePromise(stdout)
    })
  })
}

function pushDefaultExcludes(args: string[]): void {
  args.push('--glob', GIT_EXCLUDE)
  for (const exclude of SENSITIVE_RIPGREP_EXCLUDES) args.push('--glob', exclude)
}

function assertSafeSearchPath(path: string): void {
  assertNonGitPath(path, {
    code: 'SEARCH_GIT_PATH',
    message: 'Refusing to search the .git directory'
  })
  assertNonSensitivePath(path, {
    code: 'SEARCH_CREDENTIAL_PATH',
    message: 'Refusing to search credential path'
  })
}

function contentArgs(query: GrepQuery): string[] {
  const args = ['--json', '--hidden']
  if (query.noIgnore) args.push('--no-ignore')
  if (query.caseInsensitive) args.push('-i')
  if (query.multiline) args.push('-U', '--multiline-dotall')
  if (query.type) args.push('--type', query.type)
  if (query.glob) args.push('--glob', query.glob)
  pushDefaultExcludes(args)
  if (typeof query.contextBefore === 'number') args.push('-B', String(query.contextBefore))
  if (typeof query.contextAfter === 'number') args.push('-A', String(query.contextAfter))
  args.push('-e', query.pattern)
  return args
}

function pathArgs(query: GrepQuery, modeFlag: '-l' | '-c'): string[] {
  const args = [modeFlag, '--hidden']
  if (query.noIgnore) args.push('--no-ignore')
  if (query.caseInsensitive) args.push('-i')
  if (query.multiline) args.push('-U', '--multiline-dotall')
  if (query.type) args.push('--type', query.type)
  if (query.glob) args.push('--glob', query.glob)
  pushDefaultExcludes(args)
  args.push('-e', query.pattern)
  return args
}

interface RgJsonLine {
  type: string
  data?: {
    path?: { text?: string }
    line_number?: number
    lines?: { text?: string }
  }
}

function parseContent(stdout: string): GrepMatch[] {
  const matches: GrepMatch[] = []
  for (const line of stdout.split('\n')) {
    if (!line) continue
    let parsed: RgJsonLine
    try {
      parsed = JSON.parse(line) as RgJsonLine
    } catch {
      continue
    }
    if (parsed.type !== 'match' && parsed.type !== 'context') continue
    const data = parsed.data
    const text = data?.lines?.text
    if (typeof text !== 'string') continue
    matches.push({
      file: data?.path?.text ?? '',
      line: data?.line_number ?? 0,
      text: text.replace(/\r?\n$/, '').slice(0, MAX_COLUMNS)
    })
  }
  return matches
}

function parseCount(line: string): number {
  const idx = line.lastIndexOf(':')
  const value = Number(idx >= 0 ? line.slice(idx + 1) : line)
  return Number.isFinite(value) ? value : 0
}

export function createSearchBackend(
  root: string,
  options: SearchBackendOptions = {}
): SearchBackend {
  const normalizedRoot = resolve(root)
  const dangerous = options.dangerous === true

  const within = (target: string, base: string): boolean => {
    const rel = relative(base, target)
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  }

  const resolveScope = async (
    path: string | undefined
  ): Promise<{ cwd: string; targets: string[] }> => {
    if (!path) return { cwd: normalizedRoot, targets: [] }
    assertSafeSearchPath(path)
    const target = resolve(normalizedRoot, path)
    if (!dangerous && !within(target, normalizedRoot)) {
      throw new TanzoValidationError('FS_PATH_ESCAPE', `Path escapes workspace sandbox: ${path}`)
    }
    let s: Awaited<ReturnType<typeof stat>>
    try {
      s = await stat(target)
    } catch (error) {
      throw new TanzoValidationError('SEARCH_PATH_NOT_FOUND', `Search path not found: ${path}`, {
        cause: error,
        recoverable: true
      })
    }
    if (dangerous) {
      const realTarget = await realpath(target)
      assertSafeSearchPath(realTarget)
      if (s.isDirectory()) return { cwd: target, targets: [] }
      if (s.isFile()) return { cwd: dirname(target), targets: [basename(target)] }
    }

    const [realRoot, realTarget] = await Promise.all([realpath(normalizedRoot), realpath(target)])
    if (!within(realTarget, realRoot)) {
      throw new TanzoValidationError(
        'FS_PATH_ESCAPE',
        `Search path resolves outside workspace sandbox: ${path}`
      )
    }
    assertSafeSearchPath(relative(realRoot, realTarget))
    if (s.isDirectory()) return { cwd: target, targets: [] }
    if (s.isFile()) return { cwd: normalizedRoot, targets: [relative(normalizedRoot, target)] }
    throw new TanzoValidationError(
      'SEARCH_PATH_UNSUPPORTED',
      `Search path is not a file or directory: ${path}`,
      {
        recoverable: true
      }
    )
  }

  const sortByMtimeDesc = async (cwd: string, relative: string[]): Promise<string[]> => {
    const MAX_MTIME_SORT = 5000
    const STAT_CONCURRENCY = 64
    if (relative.length > MAX_MTIME_SORT) {
      return [...relative].sort((a, b) => a.localeCompare(b))
    }
    const withMtime: Array<{ path: string; mtimeMs: number }> = new Array(relative.length)
    let cursor = 0
    const worker = async (): Promise<void> => {
      while (cursor < relative.length) {
        const index = cursor++
        const p = relative[index]
        try {
          withMtime[index] = { path: p, mtimeMs: (await stat(resolve(cwd, p))).mtimeMs }
        } catch {
          withMtime[index] = { path: p, mtimeMs: 0 }
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(STAT_CONCURRENCY, relative.length) }, () => worker())
    )
    withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs)
    return withMtime.map((h) => h.path)
  }

  return {
    async glob(pattern, path, options: GlobOptions, signal) {
      const { cwd, targets } = await resolveScope(path)
      const args = ['--files', '--hidden', '--glob', pattern]
      pushDefaultExcludes(args)
      if (options.noIgnore) args.push('--no-ignore')
      const stdout = await runRg([...args, ...targets], cwd, signal)
      const sorted = await sortByMtimeDesc(cwd, stdout.split('\n').filter(Boolean))
      const offset = options.offset ?? 0
      const limit = options.limit ?? DEFAULT_GLOB_LIMIT
      return {
        paths: sorted.slice(offset, offset + limit),
        truncated: sorted.length > offset + limit
      }
    },

    async grep(query, signal): Promise<GrepResult> {
      const { cwd, targets } = await resolveScope(query.path)
      if (query.type) assertValidType(query.type)
      const offset = query.offset ?? 0
      const headLimit = query.headLimit ?? DEFAULT_HEAD

      if (query.mode === 'count') {
        const stdout = await runRg([...pathArgs(query, '-c'), ...targets], cwd, signal)
        const count = stdout
          .split('\n')
          .filter(Boolean)
          .reduce((sum, line) => sum + parseCount(line), 0)
        return { mode: 'count', count }
      }

      if (query.mode === 'files') {
        const stdout = await runRg([...pathArgs(query, '-l'), ...targets], cwd, signal)
        const sorted = await sortByMtimeDesc(cwd, stdout.split('\n').filter(Boolean))
        return {
          mode: 'files',
          files: sorted.slice(offset, offset + headLimit),
          truncated: sorted.length > offset + headLimit
        }
      }

      const stdout = await runRg([...contentArgs(query), ...targets], cwd, signal)
      const all = parseContent(stdout)
      return {
        mode: 'content',
        matches: all.slice(offset, offset + headLimit),
        truncated: all.length > offset + headLimit
      }
    }
  }
}
