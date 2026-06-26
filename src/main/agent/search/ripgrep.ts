import { constants, accessSync } from 'node:fs'
import { rgPath } from '@vscode/ripgrep'

let resolvedRipgrepPath: string | null = null

type PathPredicate = (path: string) => boolean

function canExecute(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export function resolveAsarUnpackedRipgrepPath(
  path: string,
  canUsePath: PathPredicate = canExecute
): string {
  const unpackedPath = path.replace(/\.asar(?=$|[/\\])/, '.asar.unpacked')
  const candidates = unpackedPath === path ? [path] : [unpackedPath, path]
  return candidates.find(canUsePath) ?? path
}

export function resolveRipgrepPath(): string {
  if (resolvedRipgrepPath) return resolvedRipgrepPath
  resolvedRipgrepPath = resolveAsarUnpackedRipgrepPath(rgPath)
  return resolvedRipgrepPath
}
