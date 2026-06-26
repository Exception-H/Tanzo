import type { SlashCommandDef } from '@shared/slash-command'
import type { SkillsStore } from '../agent/skills/types'
import type { SlashCommandStore } from './store'

export interface SlashCommandService {
  listCommands(workspaceRoot: string): SlashCommandDef[]
}

export function createSlashCommandService(
  store: SlashCommandStore,
  skills: SkillsStore
): SlashCommandService {
  return {
    listCommands(workspaceRoot) {
      const fileCommands = store.list(workspaceRoot)
      const fileCommandNames = new Set(fileCommands.map((command) => command.name))
      const skillCommands: SlashCommandDef[] = skills
        .listEnabled()
        .filter((skill) => !fileCommandNames.has(skill.name))
        .map((skill) => ({
          name: skill.name,
          kind: 'skill',
          source: 'skill',
          description: skill.description,
          skillName: skill.name
        }))
      return [...fileCommands, ...skillCommands]
    }
  }
}
