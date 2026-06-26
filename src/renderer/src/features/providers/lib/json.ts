export function parseJsonObject(value: string): Record<string, unknown> {
  const trimmed = value.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('json.objectRequired')
  }
  return parsed as Record<string, unknown>
}

export function formatJsonObject(value: Record<string, unknown> | undefined): string {
  if (!value || Object.keys(value).length === 0) return ''
  return JSON.stringify(value, null, 2)
}

export function setPathValue(
  input: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.').filter(Boolean)
  if (keys.length === 0) return input
  const next: Record<string, unknown> = { ...input }
  let cursor = next
  for (const key of keys.slice(0, -1)) {
    const child = cursor[key]
    const nextChild =
      child && typeof child === 'object' && !Array.isArray(child)
        ? { ...(child as Record<string, unknown>) }
        : {}
    cursor[key] = nextChild
    cursor = nextChild
  }
  const lastKey = keys[keys.length - 1]
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    delete cursor[lastKey]
  } else {
    cursor[lastKey] = value
  }
  return pruneEmptyObjects(next)
}

export function getPathValue(input: Record<string, unknown>, path: string): unknown {
  let current: unknown = input
  for (const key of path.split('.').filter(Boolean)) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function pruneEmptyObjects(value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const pruned = pruneEmptyObjects(child as Record<string, unknown>)
      if (Object.keys(pruned).length > 0) next[key] = pruned
      continue
    }
    if (child !== undefined && child !== '') next[key] = child
  }
  return next
}
