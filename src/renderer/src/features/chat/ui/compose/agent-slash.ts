import { parseSlashInput, type SlashCommandDef } from '@shared/slash-command'

export function normalizeAgentToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

export function resolveAgent(query: string, agents: Array<{ id: string; name: string }>) {
  const normalized = normalizeAgentToken(query)
  return agents.find(
    (agent) =>
      normalizeAgentToken(agent.id) === normalized ||
      normalizeAgentToken(agent.name) === normalized ||
      agent.name.trim().toLowerCase() === query.trim().toLowerCase()
  )
}

export function agentQueryFromInsertText(insertText?: string): string | undefined {
  if (!insertText) return undefined
  const parsed = parseSlashInput(insertText.trim())
  return parsed?.name === 'agent' ? parsed.args.trim() : undefined
}

export function agentSlashCommands(agents: Array<{ id: string; name: string }>): SlashCommandDef[] {
  const used = new Set<string>(['agent'])
  return agents.map((agent, index) => {
    const base = `agent-${normalizeAgentToken(agent.name || agent.id).replace(/[^a-z0-9-]/g, '-')}`
    const fallback = `agent-${index + 1}`
    let name = base.replace(/-+/g, '-').replace(/^-|-$/g, '') || fallback
    if (used.has(name)) name = `${name}-${index + 1}`
    used.add(name)
    return {
      name,
      kind: 'action',
      source: 'agent',
      description: agent.name,
      insertText: `/agent ${agent.id} `
    }
  })
}
