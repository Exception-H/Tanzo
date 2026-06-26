export interface DiffLine {
  type: 'context' | 'addition' | 'deletion' | 'header' | 'hunk'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface DiffStats {
  filePath: string | null
  fileName: string | null
  additions: number
  deletions: number
}

const DIFF_PARSE_CACHE_LIMIT = 24
const parsedDiffCache = new Map<string, { filePath: string | null; lines: DiffLine[] }>()

function readCachedParsedDiff(diff: string): { filePath: string | null; lines: DiffLine[] } | null {
  const cached = parsedDiffCache.get(diff)
  if (!cached) return null

  parsedDiffCache.delete(diff)
  parsedDiffCache.set(diff, cached)
  return cached
}

function writeCachedParsedDiff(
  diff: string,
  value: { filePath: string | null; lines: DiffLine[] }
): void {
  if (parsedDiffCache.has(diff)) {
    parsedDiffCache.delete(diff)
  }
  parsedDiffCache.set(diff, value)
  if (parsedDiffCache.size <= DIFF_PARSE_CACHE_LIMIT) return
  const oldestKey = parsedDiffCache.keys().next().value
  if (oldestKey !== undefined) {
    parsedDiffCache.delete(oldestKey)
  }
}

function extractDiffPath(line: string): string | null {
  const match = /^(?:---|\+\+\+)\s+(.*)$/.exec(line)
  const rawPath = match?.[1]?.trim()
  if (!rawPath || rawPath === '/dev/null') {
    return null
  }

  const withoutTimestamp = rawPath.split(/\t|\s{2,}/, 1)[0]?.trim() ?? rawPath
  if (withoutTimestamp.startsWith('a/') || withoutTimestamp.startsWith('b/')) {
    return withoutTimestamp.slice(2)
  }
  return withoutTimestamp
}

export function parseDiff(diff: string): { filePath: string | null; lines: DiffLine[] } {
  const cached = readCachedParsedDiff(diff)
  if (cached) return cached

  const rawLines = diff.split('\n')

  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop()
  }
  const lines: DiffLine[] = []
  let filePath: string | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of rawLines) {
    if (line.startsWith('Index:') || line.startsWith('===')) {
      if (line.startsWith('Index:')) filePath = line.replace('Index:', '').trim()
      lines.push({ type: 'header', content: line })
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++')) {
      filePath ||= extractDiffPath(line)
      lines.push({ type: 'header', content: line })
      continue
    }
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]!, 10)
      newLine = parseInt(hunkMatch[2]!, 10)
      lines.push({ type: 'hunk', content: line })
      continue
    }
    if (line.startsWith('+')) {
      lines.push({ type: 'addition', content: line.slice(1), newLineNumber: newLine++ })
      continue
    }
    if (line.startsWith('-')) {
      lines.push({ type: 'deletion', content: line.slice(1), oldLineNumber: oldLine++ })
      continue
    }
    if (line.startsWith(' ')) {
      lines.push({
        type: 'context',
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++
      })
    }
  }
  const parsed = { filePath, lines }
  writeCachedParsedDiff(diff, parsed)
  return parsed
}

export function isDiffOutput(output: string): boolean {
  if (typeof output !== 'string') return false
  return (
    (output.includes('@@') && (output.includes('---') || output.includes('+++'))) ||
    output.startsWith('Index:') ||
    /^[-+]{3}\s/.test(output)
  )
}

export function parseDiffStats(diff: string): DiffStats {
  const { filePath, lines } = parseDiff(diff)
  let additions = 0
  let deletions = 0
  for (const line of lines) {
    if (line.type === 'addition') additions++
    if (line.type === 'deletion') deletions++
  }
  const fileName = filePath ? (filePath.split(/[/\\]/).pop() ?? null) : null
  return { filePath, fileName, additions, deletions }
}
