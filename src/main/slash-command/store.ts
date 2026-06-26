import { readFileSync, readdirSync, type Dirent } from 'node:fs'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import type { SlashCommandDef } from '@shared/slash-command'
import { parseFrontmatter } from '../agent/skills/frontmatter'
import type { Logger } from '../agent/logging'

export interface SlashCommandStore {
  list(workspaceRoot: string): SlashCommandDef[]
}

export function createSlashCommandStore(deps: {
  userDir: string
  logger: Logger
}): SlashCommandStore {
  return {
    list: (workspaceRoot) => loadCommands(workspaceRoot, deps)
  }
}

function loadCommands(
  workspaceRoot: string,
  deps: { userDir: string; logger: Logger }
): SlashCommandDef[] {
  const commands = new Map<string, SlashCommandDef>()
  const roots = [
    join(homedir(), '.tanzo', 'commands'),
    join(deps.userDir, 'commands'),
    join(workspaceRoot, '.tanzo', 'commands')
  ]
  for (const root of roots) {
    for (const command of loadFromRoot(root, deps.logger)) {
      commands.set(command.name, command)
    }
  }
  return [...commands.values()]
}

function loadFromRoot(root: string, logger: Logger): SlashCommandDef[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  const resolved: SlashCommandDef[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const command = loadCommand(join(root, entry.name), logger)
    if (command) resolved.push(command)
  }
  return resolved
}

function loadCommand(filePath: string, logger: Logger): SlashCommandDef | undefined {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (error) {
    logger.warn(`failed to read slash command ${filePath}`, error)
    return undefined
  }

  const { data, body } = parseFrontmatter(raw)
  const template = body.trim()
  if (!template) {
    logger.warn(`slash command ${filePath} has an empty body; skipped`)
    return undefined
  }

  const name = basename(filePath, '.md')
  const description =
    typeof data.description === 'string' && data.description.trim()
      ? data.description.trim()
      : undefined
  const argsHint =
    typeof data['argument-hint'] === 'string' && data['argument-hint'].trim()
      ? data['argument-hint'].trim()
      : undefined

  return {
    name,
    kind: 'prompt',
    source: 'command',
    template,
    ...(description ? { description } : {}),
    ...(argsHint ? { argsHint } : {})
  }
}
