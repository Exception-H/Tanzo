import { describe, expect, it } from 'vitest'
import {
  agentQueryFromInsertText,
  agentSlashCommands,
  normalizeAgentToken,
  resolveAgent
} from '@renderer/features/chat/ui/compose/agent-slash'

describe('chat/agent-slash/normalizeAgentToken', () => {
  it('trims, lowercases, and hyphenates whitespace', () => {
    expect(normalizeAgentToken('  Code Reviewer ')).toBe('code-reviewer')
    expect(normalizeAgentToken('Plan\tAgent')).toBe('plan-agent')
  })
})

describe('chat/agent-slash/resolveAgent', () => {
  const agents = [
    { id: 'main', name: 'Main' },
    { id: 'code-reviewer', name: 'Code Reviewer' }
  ]

  it('matches by id', () => {
    expect(resolveAgent('main', agents)?.id).toBe('main')
  })

  it('matches by normalized name', () => {
    expect(resolveAgent('code reviewer', agents)?.id).toBe('code-reviewer')
  })

  it('matches by case-insensitive raw name', () => {
    expect(resolveAgent('CODE REVIEWER', agents)?.id).toBe('code-reviewer')
  })

  it('returns undefined on miss', () => {
    expect(resolveAgent('unknown', agents)).toBeUndefined()
  })
})

describe('chat/agent-slash/agentQueryFromInsertText', () => {
  it('extracts the agent query', () => {
    expect(agentQueryFromInsertText('/agent foo ')).toBe('foo')
  })

  it('returns undefined for non-agent commands', () => {
    expect(agentQueryFromInsertText('/compact')).toBeUndefined()
  })

  it('returns undefined for missing input', () => {
    expect(agentQueryFromInsertText(undefined)).toBeUndefined()
  })
})

describe('chat/agent-slash/agentSlashCommands', () => {
  it('builds unique action commands sourced from agents', () => {
    const commands = agentSlashCommands([
      { id: 'main', name: 'Main' },
      { id: 'code-reviewer', name: 'Code Reviewer' }
    ])
    expect(commands).toHaveLength(2)
    for (const command of commands) {
      expect(command.kind).toBe('action')
      expect(command.source).toBe('agent')
    }
    expect(commands[0]?.name).toBe('agent-main')
    expect(commands[0]?.insertText).toBe('/agent main ')
    expect(commands[1]?.name).toBe('agent-code-reviewer')
  })

  it('dedupes colliding names with an index suffix', () => {
    const commands = agentSlashCommands([
      { id: 'a', name: 'Dup' },
      { id: 'b', name: 'Dup' }
    ])
    expect(new Set(commands.map((command) => command.name)).size).toBe(2)
  })

  it('never collides with the reserved agent command', () => {
    const commands = agentSlashCommands([{ id: 'agent', name: 'agent' }])
    expect(commands[0]?.name).not.toBe('agent')
  })
})
