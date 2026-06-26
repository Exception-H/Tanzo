export function splitDirAndFile(input: string | undefined): { fileName: string; dir: string } {
  if (!input) return { fileName: '', dir: '' }
  const sanitized = input.replace(/\\/g, '/')
  const parts = sanitized.split('/').filter(Boolean)
  if (parts.length === 0) return { fileName: '', dir: '' }
  if (parts.length === 1) return { fileName: parts[0]!, dir: '' }
  const fileName = parts[parts.length - 1]!
  const dir = parts.slice(0, -1).join('/')
  return { fileName, dir }
}

export function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function formatBytes(bytes: number | undefined): string | undefined {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return undefined
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isToolError(output: unknown): output is { error: true; message: string } {
  return (
    typeof output === 'object' &&
    output !== null &&
    'error' in output &&
    (output as { error: unknown }).error === true
  )
}
