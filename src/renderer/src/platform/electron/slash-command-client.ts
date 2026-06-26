import type { SlashCommandApi, SlashCommandDef } from '@shared/slash-command'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcErrors } from './ipc-errors'

export function requireSlashCommandApi(): SlashCommandApi {
  const slashCommandApi = window.electron?.slashCommand
  if (!slashCommandApi) {
    throw new TanzoIntegrationError(
      'ELECTRON_SLASH_COMMAND_API_UNAVAILABLE',
      'Electron slash command API is not available'
    )
  }
  return withDecodedIpcErrors(slashCommandApi)
}

export const slashCommandClient = {
  list(workspaceRoot: string): Promise<SlashCommandDef[]> {
    return requireSlashCommandApi()
      .list(workspaceRoot)
      .then((commands) => [...commands])
  }
}
