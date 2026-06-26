import type { HookTrustStatus } from '@shared/hooks'
import type { HookEntry, HookSource, HookState } from './types'

const MANAGED_SOURCES: ReadonlySet<HookSource> = new Set<HookSource>(['managed'])

export function trustStatus(entry: HookEntry, state: HookState | undefined): HookTrustStatus {
  if (MANAGED_SOURCES.has(entry.source)) return 'managed'
  if (!state?.trustedHash) return 'untrusted'
  return state.trustedHash === entry.contentHash ? 'trusted' : 'modified'
}

export function isEnabled(entry: HookEntry, state: HookState | undefined): boolean {
  if (MANAGED_SOURCES.has(entry.source)) return true
  return state?.enabled ?? true
}

export function isActive(entry: HookEntry, state: HookState | undefined): boolean {
  if (!isEnabled(entry, state)) return false
  const trust = trustStatus(entry, state)
  return trust === 'managed' || trust === 'trusted'
}
