import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import type { FileMentionEntry } from '@shared/file-mention'
import { SENSITIVE_RIPGREP_EXCLUDES } from '../agent/security/path-safety'
import { resolveRipgrepPath } from '../agent/search/ripgrep'
import { fuzzyMatch } from './fuzzy'

const RESULT_LIMIT = 20
const SCAN_CAP = 20000
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024

export interface FileMentionService {
  search(workspaceRoot: string, query: string): Promise<FileMentionEntry[]>
}

function listFiles(cwd: string): Promise<string[]> {
  return new Promise((resolvePromise) => {
    const args = ['--files', '--hidden', '--glob', '!**/.git/**']
    for (const exclude of SENSITIVE_RIPGREP_EXCLUDES) args.push('--glob', exclude)
    const child = spawn(resolveRipgrepPath(), args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let bytes = 0
    let capped = false
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (data: string) => {
      if (capped) return
      bytes += Buffer.byteLength(data)
      stdout += data
      if (bytes >= MAX_OUTPUT_BYTES) {
        capped = true
        child.kill('SIGKILL')
      }
    })
    child.on('error', () => resolvePromise([]))
    child.on('close', () => {
      resolvePromise(stdout.split('\n').filter(Boolean).slice(0, SCAN_CAP))
    })
  })
}

function baseName(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? path : path.slice(idx + 1)
}

function collectEntries(files: string[]): FileMentionEntry[] {
  const entries: FileMentionEntry[] = []
  const seenDirs = new Set<string>()

  for (const file of files) {
    entries.push({ path: file, name: baseName(file), type: 'file' })
    let slash = file.indexOf('/')
    while (slash !== -1) {
      const dir = file.slice(0, slash)
      if (!seenDirs.has(dir)) {
        seenDirs.add(dir)
        entries.push({ path: dir, name: baseName(dir), type: 'directory' })
      }
      slash = file.indexOf('/', slash + 1)
    }
  }

  return entries
}

function collectChildren(files: string[], dirPrefix: string): FileMentionEntry[] {
  const prefix = `${dirPrefix}/`
  const entries: FileMentionEntry[] = []
  const seen = new Set<string>()

  for (const file of files) {
    if (!file.startsWith(prefix)) continue
    const rest = file.slice(prefix.length)
    const slash = rest.indexOf('/')
    const childName = slash === -1 ? rest : rest.slice(0, slash)
    if (!childName) continue
    const childPath = `${dirPrefix}/${childName}`
    if (seen.has(childPath)) continue
    seen.add(childPath)
    entries.push({
      path: childPath,
      name: childName,
      type: slash === -1 ? 'file' : 'directory'
    })
  }

  return entries
}

function rank(entries: FileMentionEntry[], leaf: string): FileMentionEntry[] {
  if (!leaf) {
    return [...entries].sort((a, b) => a.path.localeCompare(b.path)).slice(0, RESULT_LIMIT)
  }

  const scored: Array<{ entry: FileMentionEntry; score: number }> = []
  for (const entry of entries) {
    const byName = fuzzyMatch(entry.name, leaf)
    const byPath = fuzzyMatch(entry.path, leaf)
    if (!byName.matched && !byPath.matched) continue
    const score = Math.min(
      byName.matched ? byName.score : Number.MAX_SAFE_INTEGER,
      byPath.matched ? byPath.score : Number.MAX_SAFE_INTEGER
    )
    scored.push({ entry, score })
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    if (a.entry.path.length !== b.entry.path.length) {
      return a.entry.path.length - b.entry.path.length
    }
    return a.entry.path.localeCompare(b.entry.path)
  })

  return scored.slice(0, RESULT_LIMIT).map((item) => item.entry)
}

export function createFileMentionService(): FileMentionService {
  return {
    async search(workspaceRoot, query) {
      const cwd = resolve(workspaceRoot)
      const files = await listFiles(cwd)

      const slash = query.lastIndexOf('/')
      if (slash !== -1) {
        const dirPrefix = query.slice(0, slash)
        const leaf = query.slice(slash + 1)
        return rank(collectChildren(files, dirPrefix), leaf)
      }

      return rank(collectEntries(files), query.trim())
    }
  }
}
