import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import type { createLogger } from '../../logger'

type ScopedLogger = ReturnType<typeof createLogger>

const DEBOUNCE_MS = 250

const GIT_SIGNAL_FILES = [
  'HEAD',
  'index',
  'MERGE_HEAD',
  'ORIG_HEAD',
  'FETCH_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'packed-refs',
  'COMMIT_EDITMSG'
] as const

function resolveGitDir(cwd: string): { dotGit: string; gitDir: string } | null {
  const dotGit = join(cwd, '.git')
  try {
    const stat = statSync(dotGit)
    if (stat.isDirectory()) return { dotGit, gitDir: dotGit }
    if (stat.isFile()) {
      const content = readFileSync(dotGit, 'utf8')
      const match = /^gitdir:\s*(.+)$/m.exec(content)
      if (match?.[1]) return { dotGit, gitDir: resolve(cwd, match[1].trim()) }
    }
  } catch {
    return null
  }
  return null
}

function gitWatchPaths(cwd: string): string[] {
  const resolved = resolveGitDir(cwd)
  if (!resolved) return []
  const { dotGit, gitDir } = resolved
  const paths = [...GIT_SIGNAL_FILES.map((file) => join(gitDir, file)), join(gitDir, 'refs')]
  if (dotGit !== gitDir && existsSync(dotGit)) paths.push(dotGit)
  return paths
}

export interface GitWatcher {
  watch(cwd: string): void
  unwatch(cwd: string): void
  unwatchAll(): void
}

interface Entry {
  watcher: FSWatcher
  timer: ReturnType<typeof setTimeout> | null
  refCount: number
}

export interface GitWatcherOptions {
  broadcast: (cwd: string) => void
  logger: Pick<ScopedLogger, 'warn'>
}

export function createGitWatcher(options: GitWatcherOptions): GitWatcher {
  const entries = new Map<string, Entry>()

  function schedule(cwd: string, entry: Entry): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      entry.timer = null
      options.broadcast(cwd)
    }, DEBOUNCE_MS)
  }

  function close(entry: Entry): void {
    if (entry.timer) clearTimeout(entry.timer)
    void entry.watcher.close()
  }

  return {
    watch(cwd) {
      const existing = entries.get(cwd)
      if (existing) {
        existing.refCount += 1
        return
      }
      const watcher = watch(gitWatchPaths(cwd), {
        ignoreInitial: true,
        depth: 32
      })
      const entry: Entry = { watcher, timer: null, refCount: 1 }
      entries.set(cwd, entry)
      watcher.on('all', () => schedule(cwd, entry))
      watcher.on('error', (error) => options.logger.warn('git watcher error', { cwd, error }))
    },

    unwatch(cwd) {
      const entry = entries.get(cwd)
      if (!entry) return
      entry.refCount -= 1
      if (entry.refCount > 0) return
      close(entry)
      entries.delete(cwd)
    },

    unwatchAll() {
      for (const entry of entries.values()) close(entry)
      entries.clear()
    }
  }
}
