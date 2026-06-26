import { TanzoValidationError } from '@shared/errors'

const SENSITIVE_PATH_PATTERN_TEXT =
  '(^|/)(?:\\.[sS][sS][hH]|\\.[aA][wW][sS])(?:/|$)|(^|/)\\.[eE][nN][vV](?:[rR][cC])?(?:$|[/.])'
const GIT_PATH_PATTERN_TEXT = '(^|/)\\.[gG][iI][tT](?:/|$)'

const SENSITIVE_PATH_RE = new RegExp(SENSITIVE_PATH_PATTERN_TEXT)
const GIT_PATH_RE = new RegExp(GIT_PATH_PATTERN_TEXT)

export const SENSITIVE_PATH_PATTERN = SENSITIVE_PATH_PATTERN_TEXT

export const SENSITIVE_RIPGREP_EXCLUDES = [
  '!**/.ssh/**',
  '!**/.aws/**',
  '!**/.env',
  '!**/.env.*',
  '!**/.envrc'
]

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH_RE.test(normalizePath(path))
}

export function isGitPath(path: string): boolean {
  return GIT_PATH_RE.test(normalizePath(path))
}

export function assertNonSensitivePath(
  path: string,
  input: { code: string; message: string }
): void {
  if (!isSensitivePath(path)) return
  throw new TanzoValidationError(input.code, `${input.message}: ${path}`)
}

export function assertNonGitPath(path: string, input: { code: string; message: string }): void {
  if (!isGitPath(path)) return
  throw new TanzoValidationError(input.code, `${input.message}: ${path}`)
}
