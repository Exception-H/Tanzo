import { existsSync } from 'node:fs'
import { delimiter, extname, isAbsolute, join, resolve } from 'node:path'
import { TanzoValidationError } from '@shared/errors'

const WINDOWS_EXECUTABLE_EXTENSIONS = new Set(['.com', '.exe'])
const WINDOWS_SHELL_EXTENSIONS = new Set(['.bat', '.cmd'])
const DEFAULT_WINDOWS_PATH_EXTENSIONS = ['.COM', '.EXE', '.BAT', '.CMD']
const CMD_METACHARACTERS = /[&|<>^"%!()]/

export interface StdioLaunchCommand {
  command: string
  args: string[]
}

export interface ResolveStdioLaunchCommandOptions {
  cwd?: string
  platform?: NodeJS.Platform
}

function getEnvValueCaseInsensitive(env: Record<string, string>, key: string): string | undefined {
  const exact = env[key]
  if (exact !== undefined) return exact
  const foundKey = Object.keys(env).find(
    (existingKey) => existingKey.toLowerCase() === key.toLowerCase()
  )
  return foundKey ? env[foundKey] : undefined
}

function windowsPathExtensions(env: Record<string, string>): string[] {
  const pathExt = getEnvValueCaseInsensitive(env, 'PATHEXT')
  if (!pathExt) return DEFAULT_WINDOWS_PATH_EXTENSIONS
  return pathExt
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
}

function windowsPathEntries(env: Record<string, string>): string[] {
  const pathValue = getEnvValueCaseInsensitive(env, 'PATH')
  if (!pathValue) return []
  return pathValue
    .split(delimiter)
    .map((value) => value.trim())
    .filter(Boolean)
}

function looksLikePath(command: string): boolean {
  return (
    command.includes('\\') ||
    command.includes('/') ||
    command.startsWith('.') ||
    isAbsolute(command)
  )
}

function candidateCommandFiles(baseCommandPath: string, extensions: string[]): string[] {
  if (extname(baseCommandPath)) return [baseCommandPath]
  return [...extensions.map((extension) => `${baseCommandPath}${extension}`), baseCommandPath]
}

function resolveWindowsCommandPath(
  command: string,
  env: Record<string, string>,
  cwd?: string
): string | undefined {
  const extensions = windowsPathExtensions(env)

  if (looksLikePath(command)) {
    const basePath = isAbsolute(command) ? command : resolve(cwd ?? process.cwd(), command)
    return candidateCommandFiles(basePath, extensions).find((candidate) => existsSync(candidate))
  }

  for (const pathEntry of windowsPathEntries(env)) {
    const resolvedCommand = candidateCommandFiles(join(pathEntry, command), extensions).find(
      (candidate) => existsSync(candidate)
    )
    if (resolvedCommand) return resolvedCommand
  }

  return undefined
}

export function resolveStdioLaunchCommand(
  command: string,
  args: string[] = [],
  env: Record<string, string>,
  options: ResolveStdioLaunchCommandOptions = {}
): StdioLaunchCommand {
  if ((options.platform ?? process.platform) !== 'win32') {
    return { command, args }
  }

  const resolvedCommand = resolveWindowsCommandPath(command, env, options.cwd)
  if (!resolvedCommand) {
    return { command, args }
  }

  const extension = extname(resolvedCommand).toLowerCase()
  if (WINDOWS_EXECUTABLE_EXTENSIONS.has(extension)) {
    return { command: resolvedCommand, args }
  }

  if (WINDOWS_SHELL_EXTENSIONS.has(extension)) {
    for (const arg of args) {
      if (CMD_METACHARACTERS.test(arg)) {
        throw new TanzoValidationError(
          'MCP_STDIO_ARG_UNSAFE',
          `Argument "${arg}" contains characters unsafe for a Windows batch command.`
        )
      }
    }
    return {
      command: getEnvValueCaseInsensitive(env, 'ComSpec') ?? 'cmd.exe',
      args: ['/d', '/c', resolvedCommand, ...args]
    }
  }

  return { command: resolvedCommand, args }
}
