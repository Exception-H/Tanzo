import type { FileMentionApi, FileMentionEntry } from '@shared/file-mention'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

export function requireFileMentionApi(): FileMentionApi {
  const fileMentionApi = window.electron?.fileMention
  if (!fileMentionApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_FILE_MENTION_API_UNAVAILABLE',
      'Electron file mention API is not available'
    )
  }
  return withDecodedIpcErrors(fileMentionApi)
}

export const fileMentionClient = {
  search(workspaceRoot: string, query: string): Promise<FileMentionEntry[]> {
    return requireFileMentionApi()
      .search(workspaceRoot, query)
      .then((entries) => [...entries])
  }
}
