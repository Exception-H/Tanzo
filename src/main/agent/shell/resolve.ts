import { platform as currentPlatform } from 'node:os'

export type ShellSyntax = 'posix' | 'powershell' | 'cmd'

export interface ShellCandidate {
  file: string
  label: string
  syntax: ShellSyntax
  args(command: string): string[]
}

export interface ShellResolveOptions {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

function addCandidate(
  candidates: ShellCandidate[],
  seen: Set<string>,
  candidate: ShellCandidate
): void {
  const key = `${candidate.file}\0${candidate.syntax}`.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  candidates.push(candidate)
}

function posixCandidate(file: string): ShellCandidate {
  return {
    file,
    label: file,
    syntax: 'posix',
    args: (command) => ['-lc', command]
  }
}

function powershellCandidate(file: string): ShellCandidate {
  return {
    file,
    label: file,
    syntax: 'powershell',
    args: (command) => ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]
  }
}

function cmdCandidate(file: string): ShellCandidate {
  return {
    file,
    label: file,
    syntax: 'cmd',
    args: (command) => ['/d', '/s', '/c', command]
  }
}

export function resolveShellCandidates(options: ShellResolveOptions = {}): ShellCandidate[] {
  const targetPlatform = options.platform ?? currentPlatform()
  const env = options.env ?? process.env
  const candidates: ShellCandidate[] = []
  const seen = new Set<string>()

  if (targetPlatform === 'win32') {
    addCandidate(candidates, seen, powershellCandidate('pwsh.exe'))
    addCandidate(candidates, seen, powershellCandidate('powershell.exe'))
    addCandidate(candidates, seen, cmdCandidate(env.ComSpec || env.COMSPEC || 'cmd.exe'))
    return candidates
  }

  const configuredShell = env.SHELL?.trim()
  if (configuredShell) addCandidate(candidates, seen, posixCandidate(configuredShell))
  addCandidate(candidates, seen, posixCandidate('bash'))
  addCandidate(candidates, seen, posixCandidate('sh'))

  return candidates
}

export function describeShellRuntime(options: ShellResolveOptions = {}): string {
  const targetPlatform = options.platform ?? currentPlatform()
  const candidates = resolveShellCandidates({ ...options, platform: targetPlatform })
  const labels = candidates.map((candidate) => candidate.label).join(' → ')

  if (targetPlatform === 'win32') {
    return `${labels} (PowerShell syntax; cmd.exe fallback)`
  }

  return `${labels} (Unix shell syntax)`
}
