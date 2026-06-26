export interface FuzzyScore {
  score: number
  matched: boolean
}

export function fuzzyMatch(haystack: string, needle: string): FuzzyScore {
  if (needle.length === 0) return { score: Number.MAX_SAFE_INTEGER, matched: true }

  const loweredHaystack = haystack.toLowerCase()
  const loweredNeedle = needle.toLowerCase()

  let cursor = 0
  let firstPos = -1
  let lastPos = -1

  for (const char of loweredNeedle) {
    const found = loweredHaystack.indexOf(char, cursor)
    if (found === -1) return { score: 0, matched: false }
    if (firstPos === -1) firstPos = found
    lastPos = found
    cursor = found + 1
  }

  const window = lastPos - firstPos + 1 - loweredNeedle.length
  let score = Math.max(window, 0)
  if (firstPos === 0) score -= 100

  return { score, matched: true }
}
