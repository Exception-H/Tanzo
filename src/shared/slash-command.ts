export type SlashCommandKind = 'action' | 'prompt' | 'skill'
export type SlashCommandSource = 'builtin' | 'agent' | 'command' | 'skill'

export interface SlashCommandDef {
  name: string
  kind: SlashCommandKind
  source: SlashCommandSource
  descriptionKey?: string
  description?: string
  argsHint?: string
  template?: string
  skillName?: string
  insertText?: string
}

export interface ParsedSlashInput {
  name: string
  args: string
}

const SLASH_INPUT = /^\/([a-z0-9][a-z0-9-]*)(?:[ \t]+([\s\S]*))?$/

export function parseSlashInput(text: string): ParsedSlashInput | null {
  if (!text.startsWith('/')) return null
  const firstLineEnd = text.indexOf('\n')
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd)
  const match = SLASH_INPUT.exec(firstLine)
  if (!match) return null
  const [, name, inlineArgs] = match
  const rest = firstLineEnd === -1 ? '' : text.slice(firstLineEnd + 1)
  const args = [inlineArgs ?? '', rest].filter((part) => part.length > 0).join('\n')
  return { name, args }
}

export function expandTemplate(template: string, args: string): string {
  const positional = args.trim().length > 0 ? args.trim().split(/\s+/) : []
  return template
    .replace(/\$ARGUMENTS\b/g, args)
    .replace(/\$(\d+)/g, (_whole, index: string) => positional[Number(index) - 1] ?? '')
}

export const SLASH_COMMAND_CHANNELS = {
  list: 'slash-command:list'
} as const

export type SlashCommandChannel =
  (typeof SLASH_COMMAND_CHANNELS)[keyof typeof SLASH_COMMAND_CHANNELS]

export interface SlashCommandApi {
  list(workspaceRoot: string): Promise<SlashCommandDef[]>
}
