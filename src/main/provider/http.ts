import { z } from 'zod'

export function ensureUrlProtocol(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback.trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

export function formatModelName(id: string): string {
  return id
    .replace(/^models\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function buildHeaders(
  credentials: Record<string, string>,
  headers: Record<string, string> = {}
): Record<string, string> {
  const organization = credentials.organization?.trim()
  const project = credentials.project?.trim()
  return {
    ...headers,
    ...(organization ? { 'OpenAI-Organization': organization } : {}),
    ...(project ? { 'OpenAI-Project': project } : {})
  }
}

export async function fetchJson<T>(
  url: string,
  parse: (value: unknown) => T,
  options: { timeout?: number; headers?: Record<string, string> } = {}
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 30_000)
  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: controller.signal
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
    }
    return parse(text ? JSON.parse(text) : null)
  } finally {
    clearTimeout(timer)
  }
}

export const idOnlyModelListSchema = z.object({
  data: z.array(z.object({ id: z.string(), owned_by: z.string().optional() }))
})

export const anthropicModelListSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      display_name: z.string().optional()
    })
  ),
  has_more: z.boolean().optional(),
  last_id: z.string().nullable().optional()
})

export const googleModelListSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string().optional(),
        baseModelId: z.string().optional(),
        displayName: z.string().optional(),
        description: z.string().optional(),
        supportedGenerationMethods: z.array(z.string()).optional()
      })
    )
    .optional()
})
