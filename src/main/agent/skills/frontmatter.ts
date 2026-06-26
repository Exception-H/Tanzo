const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = FRONTMATTER.exec(normalized)
  if (!match) return { data: {}, body: normalized }

  const [, yaml, body] = match
  const data: Record<string, unknown> = {}
  const lines = yaml.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue
    const sep = trimmed.indexOf(':')
    if (sep <= 0) continue
    const key = trimmed.slice(0, sep).trim()
    const rawValue = trimmed.slice(sep + 1).trim()

    if (rawValue === '') {
      const items: string[] = []
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
        items.push(unquote(lines[++i].trim().slice(2).trim()))
      }
      data[key] = items.filter((item) => item.length > 0)
      continue
    }
    data[key] = parseValue(rawValue)
  }
  return { data, body }
}

function parseValue(value: string): unknown {
  if (value === '') return ''
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter((item) => item.length > 0)
  }
  return unquote(value)
}

function unquote(value: string): string {
  const first = value[0]
  const last = value[value.length - 1]
  if (value.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    return value.slice(1, -1)
  }
  return value
}
