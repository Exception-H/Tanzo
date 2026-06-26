import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentKind, AgentSummary } from '@shared/chat'
import type { Logger } from '../logging'
import { AgentParseError, defFromMarkdown } from './parse'
import { BUILTIN_AGENTS } from './builtin'
import type { AgentDefinition, AgentIdentity, AgentLoadError } from './types'

interface DirCache {
  mtimeMs: number
  agents: AgentDefinition[]
  errors: AgentLoadError[]
}

export function toAgentSummary(def: AgentDefinition): AgentSummary {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    kind: def.kind
  }
}

export function createAgentIdentity(deps: {
  workspaceRoot: string
  defaultModelRef: () => string
  logger: Logger
}): AgentIdentity {
  const { workspaceRoot, defaultModelRef, logger } = deps

  const dirs: Array<{ path: string; kind: AgentKind }> = [
    { path: join(workspaceRoot, '.tanzo', 'agents'), kind: 'main' },
    { path: join(workspaceRoot, '.tanzo', 'subagents'), kind: 'subagent' }
  ]
  const caches = new Map<string, DirCache>()

  function loadDir(dir: string, kind: AgentKind): DirCache {
    let mtimeMs: number
    try {
      mtimeMs = statSync(dir).mtimeMs
    } catch {
      const empty = { mtimeMs: -1, agents: [], errors: [] }
      caches.set(dir, empty)
      return empty
    }
    const cached = caches.get(dir)
    if (cached && cached.mtimeMs === mtimeMs) return cached

    const agents: AgentDefinition[] = []
    const errors: AgentLoadError[] = []
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.md')) continue
      const filePath = join(dir, entry)
      try {
        agents.push(
          defFromMarkdown(readFileSync(filePath, 'utf8'), entry.replace(/\.md$/, ''), kind)
        )
      } catch (error) {
        const message = error instanceof AgentParseError ? error.message : String(error)
        logger.warn('failed to load agent definition', { filePath, message })
        errors.push({ file: filePath, message })
      }
    }
    const fresh = { mtimeMs, agents, errors }
    caches.set(dir, fresh)
    return fresh
  }

  const loadUserAgents = (): DirCache[] => dirs.map((d) => loadDir(d.path, d.kind))

  const withDefaultModel = (def: AgentDefinition): AgentDefinition =>
    def.modelRef ? def : { ...def, modelRef: defaultModelRef() }

  const resolveAgentType = (name: string): AgentDefinition | undefined => {
    const builtin = BUILTIN_AGENTS.find((agent) => agent.name === name)
    if (builtin) return withDefaultModel(builtin)
    for (const dir of loadUserAgents()) {
      const user = dir.agents.find((agent) => agent.name === name)
      if (user) return withDefaultModel(user)
    }
    return undefined
  }

  const listAgents = (kind: AgentKind): AgentDefinition[] => {
    const builtin = BUILTIN_AGENTS.filter((agent) => agent.kind === kind)
    const builtinNames = new Set(builtin.map((agent) => agent.name))
    const user = loadUserAgents()
      .flatMap((dir) => dir.agents)
      .filter((agent) => agent.kind === kind && !builtinNames.has(agent.name))
    return [...builtin, ...user].map(withDefaultModel)
  }

  const listAgentTypes = (): AgentDefinition[] => [...listAgents('main'), ...listAgents('subagent')]

  const listLoadErrors = (): AgentLoadError[] => loadUserAgents().flatMap((dir) => dir.errors)

  return { resolveAgentType, listAgents, listAgentTypes, listLoadErrors }
}
