const FENCE_SPLIT_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g
const FENCE_OPEN_PATTERN = /(^|\n)(`{3,}|~{3,})/

export function splitMarkdownBlocks(content: string): string[] {
  const blocks: string[] = []
  const segments = content.split(FENCE_SPLIT_PATTERN)
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (!segment) continue
    if (index % 2 === 1) {
      blocks.push(segment)
      continue
    }
    const open = FENCE_OPEN_PATTERN.exec(segment)
    const cut = open ? open.index + (open[1]?.length ?? 0) : segment.length
    for (const part of segment.slice(0, cut).split(/\n{2,}/)) {
      if (part.trim()) blocks.push(part)
    }
    const tail = segment.slice(cut)
    if (tail.trim()) blocks.push(tail)
  }
  return blocks
}
