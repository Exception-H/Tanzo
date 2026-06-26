function mapCode(code: number): string {
  if (code === 0x2018 || code === 0x2019 || code === 0x201a || code === 0x201b) return "'"

  if (code === 0x201c || code === 0x201d || code === 0x201e || code === 0x201f) return '"'

  if ((code >= 0x2010 && code <= 0x2015) || code === 0x2212) return '-'

  if (
    code === 0x00a0 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000
  ) {
    return ' '
  }
  return String.fromCharCode(code)
}

function normalize(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) out += mapCode(s.charCodeAt(i))
  return out
}

function canonicalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n')
}

function findAll(haystack: string, needle: string): number[] {
  const out: number[] = []
  if (!needle) return out
  let from = 0
  for (;;) {
    const i = haystack.indexOf(needle, from)
    if (i === -1) break
    out.push(i)
    from = i + needle.length
  }
  return out
}

export interface Located {
  starts: number[]
  length: number
}

function tryLocate(content: string, oldText: string): Located | null {
  const exact = findAll(content, oldText)
  if (exact.length) return { starts: exact, length: oldText.length }

  const nC = normalize(content)
  const nO = normalize(oldText)
  if (nC !== content || nO !== oldText) {
    const norm = findAll(nC, nO)
    if (norm.length) return { starts: norm, length: oldText.length }
  }

  return null
}

function candidateNeedles(oldText: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (value: string): void => {
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push(value)
  }

  push(oldText)

  const canonical = canonicalizeNewlines(oldText)
  push(canonical)

  for (const candidate of [...out]) {
    if (candidate.endsWith('\n') && candidate.length > 1) push(candidate.slice(0, -1))
    if (candidate.startsWith('\n') && candidate.length > 1) push(candidate.slice(1))
    if (candidate.startsWith('\n') && candidate.endsWith('\n') && candidate.length > 2) {
      push(candidate.slice(1, -1))
    }
  }

  return out
}

export function locate(content: string, oldText: string): Located | null {
  for (const candidate of candidateNeedles(oldText)) {
    const located = tryLocate(content, candidate)
    if (located) return located
  }

  return null
}

export function applyReplacements(
  content: string,
  starts: number[],
  length: number,
  newText: string
): string {
  let result = content
  for (const start of [...starts].sort((a, b) => b - a)) {
    result = result.slice(0, start) + newText + result.slice(start + length)
  }
  return result
}

export function lineNumberAt(content: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset; i++) {
    if (content.charCodeAt(i) === 10) line++
  }
  return line
}
