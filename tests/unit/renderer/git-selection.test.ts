import { describe, expect, it } from 'vitest'
import {
  computeCounts,
  firstSelectableEntry,
  resolveCommitFile,
  resolveCommitHash,
  resolveSelectedFile,
  selectedEntryFor,
  type GitReviewSelectedFile
} from '@renderer/features/git/model/git-selection'
import type {
  GitCommitDetails,
  GitHistoryPage,
  GitOverview,
  GitStatusEntry,
  GitStatusSnapshot
} from '@shared/git'

const scope = (status: 'modified' | 'added' = 'modified') => ({
  status,
  additions: 0,
  deletions: 0,
  binary: false,
  diffAvailable: true
})

function entry(path: string, overrides: Partial<GitStatusEntry> = {}): GitStatusEntry {
  return {
    path,
    untracked: false,
    conflicted: false,
    ...overrides
  }
}

function status(entries: GitStatusEntry[]): GitStatusSnapshot {
  return {
    head: { ref: null, detached: false, ahead: 0, behind: 0, hasCommits: true },
    isClean: false,
    hasConflicts: false,
    entries
  }
}

function history(hashes: string[]): GitHistoryPage {
  return {
    entries: hashes.map((hash) => ({
      hash,
      shortHash: hash.slice(0, 7),
      subject: hash,
      author: 'a',
      date: '2024'
    }))
  }
}

function commit(files: string[]): GitCommitDetails {
  return {
    hash: 'h',
    shortHash: 'h',
    subject: 's',
    body: '',
    author: 'a',
    date: '2024',
    files: files.map((path) => ({
      path,
      status: 'modified',
      additions: 0,
      deletions: 0,
      binary: false
    }))
  }
}

describe('firstSelectableEntry', () => {
  it('prefers conflicts, then unstaged, then staged', () => {
    expect(
      firstSelectableEntry(
        status([
          entry('a.ts', { staged: scope() }),
          entry('b.ts', { unstaged: scope() }),
          entry('c.ts', { conflicted: true, unstaged: scope() })
        ])
      )
    ).toEqual({ path: 'c.ts', scope: 'unstaged' })
  })

  it('falls back to staged when nothing else', () => {
    expect(firstSelectableEntry(status([entry('a.ts', { staged: scope() })]))).toEqual({
      path: 'a.ts',
      scope: 'staged'
    })
  })

  it('returns null for empty / null status', () => {
    expect(firstSelectableEntry(status([]))).toBeNull()
    expect(firstSelectableEntry(null)).toBeNull()
  })
})

describe('resolveSelectedFile', () => {
  const snap = status([entry('a.ts', { unstaged: scope() }), entry('b.ts', { staged: scope() })])

  it('keeps valid intent', () => {
    const intent: GitReviewSelectedFile = { path: 'b.ts', scope: 'staged' }
    expect(resolveSelectedFile(intent, snap)).toEqual(intent)
  })

  it('drops intent whose scope no longer matches and falls back', () => {
    const intent: GitReviewSelectedFile = { path: 'b.ts', scope: 'unstaged' }
    expect(resolveSelectedFile(intent, snap)).toEqual({ path: 'a.ts', scope: 'unstaged' })
  })

  it('drops intent whose path disappeared', () => {
    const intent: GitReviewSelectedFile = { path: 'gone.ts', scope: 'unstaged' }
    expect(resolveSelectedFile(intent, snap)).toEqual({ path: 'a.ts', scope: 'unstaged' })
  })

  it('returns null intent against null status', () => {
    expect(resolveSelectedFile(null, null)).toBeNull()
  })
})

describe('resolveCommitHash', () => {
  it('keeps valid intent, else newest', () => {
    const page = history(['c3', 'c2', 'c1'])
    expect(resolveCommitHash('c2', page)).toBe('c2')
    expect(resolveCommitHash('gone', page)).toBe('c3')
    expect(resolveCommitHash(null, page)).toBe('c3')
    expect(resolveCommitHash('c1', history([]))).toBeNull()
    expect(resolveCommitHash('c1', null)).toBeNull()
  })
})

describe('resolveCommitFile', () => {
  it('keeps valid intent, else first file', () => {
    const details = commit(['x.ts', 'y.ts'])
    expect(resolveCommitFile('y.ts', details)).toBe('y.ts')
    expect(resolveCommitFile('gone', details)).toBe('x.ts')
    expect(resolveCommitFile(null, details)).toBe('x.ts')
    expect(resolveCommitFile('x.ts', commit([]))).toBeNull()
    expect(resolveCommitFile('x.ts', null)).toBeNull()
  })
})

describe('selectedEntryFor', () => {
  it('finds entry by path regardless of scope', () => {
    const snap = status([entry('a.ts', { staged: scope(), unstaged: scope() })])
    expect(selectedEntryFor({ path: 'a.ts', scope: 'staged' }, snap)?.path).toBe('a.ts')
    expect(selectedEntryFor({ path: 'missing.ts', scope: 'staged' }, snap)).toBeNull()
    expect(selectedEntryFor(null, snap)).toBeNull()
  })
})

describe('computeCounts', () => {
  const overview: GitOverview = {
    cwd: '/r',
    repositoryRootPath: '/r',
    kind: 'repository',
    branch: 'main',
    headSha: null,
    isDirty: true,
    isDetached: false,
    hasInitialCommit: true,
    ahead: 0,
    behind: 0,
    stagedCount: 9,
    unstagedCount: 9,
    untrackedCount: 9,
    conflictCount: 9,
    updatedAt: '2024'
  }

  it('derives counts from status entries when present', () => {
    const snap = status([
      entry('a.ts', { staged: scope() }),
      entry('b.ts', { unstaged: scope() }),
      entry('c.ts', { untracked: true, unstaged: scope('added') }),
      entry('d.ts', { conflicted: true, unstaged: scope() })
    ])
    expect(computeCounts(snap, overview)).toEqual({
      staged: 1,
      unstaged: 2,
      untracked: 1,
      conflicts: 1
    })
  })

  it('falls back to overview counts when status is null', () => {
    expect(computeCounts(null, overview)).toEqual({
      staged: 9,
      unstaged: 9,
      untracked: 9,
      conflicts: 9
    })
  })

  it('defaults to zero without status or overview', () => {
    expect(computeCounts(null, null)).toEqual({
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicts: 0
    })
  })
})
