import type { StatusResult } from 'simple-git'
import type {
  GitFileChangeStatus,
  GitStatusEntry,
  GitStatusFileScope,
  GitStatusSnapshot
} from '@shared/git'

export interface NumstatEntry {
  additions: number
  deletions: number
  binary: boolean
}

export type NumstatMap = Map<string, NumstatEntry>

export function parseNumstat(raw: string): NumstatMap {
  const map: NumstatMap = new Map()
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const [addRaw, delRaw, ...pathParts] = parts
    const path = pathParts.join('\t')
    const binary = addRaw === '-' || delRaw === '-'
    map.set(path, {
      additions: binary ? 0 : Number(addRaw) || 0,
      deletions: binary ? 0 : Number(delRaw) || 0,
      binary
    })
  }
  return map
}

function mapChangeStatus(code: string, untracked: boolean): GitFileChangeStatus {
  if (untracked) return 'untracked'
  switch (code) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    case 'M':
    default:
      return 'modified'
  }
}

function scope(
  code: string,
  untracked: boolean,
  numstat: NumstatEntry | undefined
): GitStatusFileScope {
  const stats = numstat ?? { additions: 0, deletions: 0, binary: false }
  return {
    status: mapChangeStatus(code, untracked),
    additions: stats.additions,
    deletions: stats.deletions,
    binary: stats.binary,
    diffAvailable: !stats.binary
  }
}

export function mapStatusSnapshot(
  status: StatusResult,
  stagedStats: NumstatMap,
  unstagedStats: NumstatMap,
  hasCommits = true
): GitStatusSnapshot {
  const entries: GitStatusEntry[] = status.files.map((file) => {
    const index = file.index.trim()
    const working = file.working_dir.trim()
    const conflicted =
      file.index === 'U' ||
      file.working_dir === 'U' ||
      (file.index === 'A' && file.working_dir === 'A') ||
      (file.index === 'D' && file.working_dir === 'D')
    const untracked = file.index === '?' || file.working_dir === '?'

    const entry: GitStatusEntry = {
      path: file.path,
      untracked,
      conflicted
    }
    const out: { -readonly [K in keyof GitStatusEntry]?: GitStatusEntry[K] } = entry
    if (file.from) out.oldPath = file.from

    if (index && index !== '?') {
      out.staged = scope(index, false, stagedStats.get(file.path))
    }
    if (untracked) {
      out.unstaged = scope('', true, unstagedStats.get(file.path))
    } else if (working) {
      out.unstaged = scope(working, false, unstagedStats.get(file.path))
    }
    return out as GitStatusEntry
  })

  return {
    head: {
      ref: status.current,
      detached: status.detached,
      upstream: status.tracking ?? undefined,
      ahead: status.ahead,
      behind: status.behind,
      hasCommits
    },
    isClean: status.isClean(),
    hasConflicts: entries.some((entry) => entry.conflicted),
    entries
  }
}
