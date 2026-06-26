import type { AgentKind } from '@shared/chat'
import { parseFrontmatter } from '../skills/frontmatter'
import type { AgentDefinition } from './types'

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asAllowedTools(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const tools = value
      .map(String)
      .map((part) => part.trim())
      .filter(Boolean)
    return tools.length > 0 ? tools : null
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
    return parts.length > 0 ? parts : null
  }
  return null
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function asPosInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(n) && n > 0 ? n : undefined
}

export class AgentParseError extends Error {}

function resolveKind(value: unknown, dirKind?: AgentKind): AgentKind {
  if (value === undefined || value === null || value === '') return dirKind ?? 'main'
  if (value === 'main' || value === 'subagent') return value
  throw new AgentParseError(`invalid kind "${String(value)}" (expected "main" or "subagent")`)
}

export function defFromMarkdown(
  raw: string,
  fallbackName: string,
  dirKind?: AgentKind
): AgentDefinition {
  const { data, body } = parseFrontmatter(raw)
  const name = asString(data.name) ?? fallbackName
  if (!name.trim()) throw new AgentParseError('agent definition is missing a name')

  const kind = resolveKind(data.kind, dirKind)
  const enableWebSearch = asBool(data['enable-web-search'])
  const maxSubagentDepth = asPosInt(data['max-subagent-depth'])
  const maxSteps = asPosInt(data['max-steps'])

  return {
    id: name,
    name,
    kind,
    description: asString(data.description) ?? '',
    modelRef: asString(data.model) ?? '',
    systemPrompt: body.trim(),
    allowedTools: asAllowedTools(data.tools),
    ...(enableWebSearch !== undefined ? { enableWebSearch } : {}),
    ...(maxSubagentDepth !== undefined ? { maxSubagentDepth } : {}),
    ...(maxSteps !== undefined ? { maxSteps } : {})
  }
}
