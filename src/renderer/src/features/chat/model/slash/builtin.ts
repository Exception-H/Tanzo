import type { SlashCommandDef } from '@shared/slash-command'

export const BUILTIN_SLASH_COMMANDS: SlashCommandDef[] = [
  {
    name: 'compact',
    kind: 'action',
    source: 'builtin',
    descriptionKey: 'chat.composer.slashCommands.descriptions.compact'
  },
  {
    name: 'goal',
    kind: 'action',
    source: 'builtin',
    descriptionKey: 'chat.composer.slashCommands.descriptions.goal',
    argsHint: '<objective> | clear | pause | resume'
  },
  {
    name: 'agent',
    kind: 'action',
    source: 'agent',
    descriptionKey: 'chat.composer.slashCommands.descriptions.agent',
    argsHint: '<name|id>'
  }
]
