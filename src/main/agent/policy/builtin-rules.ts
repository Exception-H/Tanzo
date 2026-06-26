import type { PolicyRule } from '@shared/policy'
import { SENSITIVE_PATH_PATTERN } from '../security/path-safety'

const deny = (id: string, match: PolicyRule['match'], reason: string): PolicyRule => ({
  id,
  source: 'builtin',
  scope: 'system',
  action: 'deny',
  priority: 0,
  match,
  reason
})

const shellCommand = (id: string, regex: string, reason: string): PolicyRule =>
  deny(id, { toolNameGlob: '{shell,shellStart}', argMatch: { path: 'command', regex } }, reason)

const shellInput = (id: string, regex: string, reason: string): PolicyRule =>
  deny(id, { toolName: 'shellWrite', argMatch: { path: 'input', regex } }, reason)

const shellDeny = (id: string, regex: string, reason: string): PolicyRule[] => [
  shellCommand(id, regex, reason),
  shellInput(`${id}-input`, regex, reason)
]

export const BUILTIN_RULES: PolicyRule[] = [
  deny(
    'b.git',
    { argMatch: { path: 'path', regex: '(^|/)\\.git(?:/|$)' } },
    'Refusing to touch the .git/ directory.'
  ),
  deny(
    'b.ssh',
    { argMatch: { path: 'path', regex: SENSITIVE_PATH_PATTERN } },
    'Refusing to read credential files.'
  ),
  ...shellDeny(
    'b.rmrf',
    '\\brm\\b(?=[^\\n]*(?:\\s-[a-zA-Z]*[rRfF][a-zA-Z]*|\\s--(?:recursive|force)))[^\\n]*\\s[\'"]?(?:(?:/|~|\\*|\\.{1,2}/\\*|\\$\\{?HOME\\}?)|\\.\\.?/?(?=[\\s;&|\'"]|$))',
    'Refusing destructive recursive delete.'
  ),
  ...shellDeny(
    'b.cred-read',
    '\\b(?:cat|less|more|head|tail|bat|nl|xxd|od|strings|base64|openssl)\\b[^\\n]*(?:\\.ssh/|\\.aws/|(?:^|[\\s/\'"])\\.env(?:rc)?\\b|\\bid_(?:rsa|ed25519|ecdsa|dsa)\\b)',
    'Refusing to read credential files via the shell.'
  ),
  ...shellDeny(
    'b.rm-no-preserve',
    '\\brm\\b[^\\n]*--no-preserve-root',
    'Refusing rm --no-preserve-root.'
  ),
  ...shellDeny(
    'b.forkbomb',
    '(?:\\(\\s*\\)\\s*\\{[^}]*\\|[^}]*&|function\\s+\\w+\\s*(?:\\(\\s*\\))?\\s*\\{[^}]*\\b\\w+\\s*\\|\\s*\\w+[^}]*&)',
    'Refusing a fork-bomb shell function.'
  ),
  ...shellDeny(
    'b.dd-device',
    '\\bdd\\b[^\\n]*\\bof=[\'"]?/dev/(r?disk|sd|nvme|hd|mmcblk|vd|loop|ram)',
    'Refusing dd write to a block device.'
  ),
  ...shellDeny('b.mkfs', '\\bmkfs(\\.[a-z0-9]+)?\\b', 'Refusing to format a filesystem.'),
  ...shellDeny(
    'b.dev-redirect',
    '>>?\\s*[\'"]?/dev/(r?disk|sd|nvme|hd|mmcblk|vd)',
    'Refusing to overwrite a block device.'
  ),
  {
    id: 'b.read',
    source: 'builtin',
    scope: 'system',
    action: 'allow',
    priority: 100,
    match: { toolNameGlob: '{fileRead,glob,grep,skill,askQuestion}' },
    reason: 'Read-only workspace access is always allowed.'
  }
]
