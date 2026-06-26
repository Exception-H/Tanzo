export const HOOK_EVENTS = [
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'SessionStart',
  'UserPromptSubmit',
  'SubagentStart',
  'SubagentStop',
  'Stop'
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

export const HOOK_EVENTS_V1 = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'Notification'
] as const

export type HookEventV1 = (typeof HOOK_EVENTS_V1)[number]

export type HookSource = 'managed' | 'user' | 'project' | 'session'

export type HookTrustStatus = 'managed' | 'trusted' | 'modified' | 'untrusted'

export interface HookEntrySummary {
  key: string
  event: HookEvent
  matcher: string | null
  command: string
  source: HookSource
  configPath?: string
  timeoutSec: number
  statusMessage?: string
  enabled: boolean
  trust: HookTrustStatus
  contentHash: string
}

export interface HookPreviewResult {
  key: string
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
  outcome?: string
  error?: string
}

export const HOOKS_CHANNELS = {
  list: 'hooks:list',
  reload: 'hooks:reload',
  setEnabled: 'hooks:set-enabled',
  setTrusted: 'hooks:set-trusted',
  preview: 'hooks:preview'
} as const

export type HooksChannel = (typeof HOOKS_CHANNELS)[keyof typeof HOOKS_CHANNELS]

export interface HooksApi {
  list(workspaceId?: string): Promise<HookEntrySummary[]>
  reload(): Promise<HookEntrySummary[]>
  setEnabled(key: string, enabled: boolean, workspaceId?: string): Promise<void>
  setTrusted(key: string, contentHash: string, workspaceId?: string): Promise<void>
  preview(key: string): Promise<HookPreviewResult>
}
