import type { GitErrorCode, GitResult } from '@shared/git'

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function classify(message: string): GitErrorCode {
  const lower = message.toLowerCase()
  if (lower.includes('not a git repository')) return 'not-a-repo'
  if (
    lower.includes('no configured push destination') ||
    lower.includes('does not appear to be a git repository')
  )
    return 'no-remote'
  if (lower.includes('no upstream') || lower.includes('no tracking information'))
    return 'no-upstream'
  if (lower.includes('nothing to commit')) return 'nothing-to-commit'
  if (lower.includes('conflict')) return 'conflict'
  return 'git-failed'
}

export function ok<T>(data: T): GitResult<T> {
  return { ok: true, data }
}

export function fail<T>(error: unknown): GitResult<T> {
  const message = messageOf(error)
  return { ok: false, code: classify(message), message }
}
