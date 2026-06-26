import { describe, expect, it, vi } from 'vitest'
import type { SlashCommandDef } from '@shared/slash-command'
import type { ResolvedSkill } from '@main/agent/skills/types'
import { createSlashCommandService } from '@main/slash-command/service'

function skill(name: string, description = `${name} skill`): ResolvedSkill {
  return {
    name,
    description,
    skillDir: `/skills/${name}`,
    body: 'body',
    allowedTools: null,
    scope: 'user'
  }
}

describe('main/slash-command/service', () => {
  it('combines file commands with skill commands', () => {
    const fileCommands: SlashCommandDef[] = [
      {
        name: 'review',
        kind: 'prompt',
        source: 'command',
        description: 'Review files',
        template: 'Review $ARGUMENTS'
      }
    ]
    const store = { list: vi.fn(() => fileCommands) }
    const skills = {
      list: vi.fn(),
      listEnabled: vi.fn(() => [skill('imagegen', 'Generate images')]),
      get: vi.fn()
    }

    const service = createSlashCommandService(store, skills)

    expect(service.listCommands('/workspace')).toEqual([
      fileCommands[0],
      {
        name: 'imagegen',
        kind: 'skill',
        source: 'skill',
        description: 'Generate images',
        skillName: 'imagegen'
      }
    ])
    expect(store.list).toHaveBeenCalledWith('/workspace')
  })

  it('does not add a skill command when a file command uses the same name', () => {
    const fileCommands: SlashCommandDef[] = [
      {
        name: 'review',
        kind: 'prompt',
        source: 'command',
        template: 'Review $ARGUMENTS'
      }
    ]
    const store = { list: vi.fn(() => fileCommands) }
    const skills = {
      list: vi.fn(),
      listEnabled: vi.fn(() => [skill('review')]),
      get: vi.fn()
    }

    const service = createSlashCommandService(store, skills)

    expect(service.listCommands('/workspace')).toEqual(fileCommands)
  })
})
