import type { SlashCommandDef, SlashCommandSource } from '@shared/slash-command'

export const SOURCE_ORDER: SlashCommandSource[] = ['builtin', 'agent', 'command', 'skill']

export function orderSlashCommands(commands: SlashCommandDef[]): SlashCommandDef[] {
  return SOURCE_ORDER.flatMap((source) => commands.filter((command) => command.source === source))
}
