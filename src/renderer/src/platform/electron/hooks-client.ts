import type { HookEntrySummary, HookPreviewResult, HooksApi } from '@shared/hooks'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

function requireHooksApi(): HooksApi {
  const hooksApi = window.electron?.hooks
  if (!hooksApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_HOOKS_API_UNAVAILABLE',
      'Electron hooks API is not available'
    )
  }
  return withDecodedIpcErrors(hooksApi)
}

export const hooksClient = {
  list(workspaceId?: string): Promise<HookEntrySummary[]> {
    return requireHooksApi().list(workspaceId)
  },
  reload(): Promise<HookEntrySummary[]> {
    return requireHooksApi().reload()
  },
  setEnabled(key: string, enabled: boolean, workspaceId?: string): Promise<void> {
    return requireHooksApi().setEnabled(key, enabled, workspaceId)
  },
  setTrusted(key: string, contentHash: string, workspaceId?: string): Promise<void> {
    return requireHooksApi().setTrusted(key, contentHash, workspaceId)
  },
  preview(key: string): Promise<HookPreviewResult> {
    return requireHooksApi().preview(key)
  }
}
