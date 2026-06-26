import type { ChangeSetApi, ChangeSetApplyInput, ChangeSetApplyResult } from '@shared/change-set'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

function requireChangeSetApi(): ChangeSetApi {
  const api = window.electron?.changeSet
  if (!api) {
    throw new TanzoIntegrationError(
      'ELECTRON_CHANGE_SET_API_UNAVAILABLE',
      'Electron change-set API is not available'
    )
  }
  return withDecodedIpcErrors(api)
}

export const changeSetClient = {
  getChangeSetFilePatch(changeSetId: string, filePath: string): Promise<string | null> {
    return requireChangeSetApi().getChangeSetFilePatch(changeSetId, filePath)
  },
  applyChangeSet(input: ChangeSetApplyInput): Promise<ChangeSetApplyResult> {
    return requireChangeSetApi().applyChangeSet(input)
  }
}
