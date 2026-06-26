import type { PickDirectoryArgs } from '@shared/system'
import { TanzoIntegrationError } from '@shared/errors'
import { withDecodedIpcError } from './ipc-errors'

function requirePickDirectory(): (args?: PickDirectoryArgs) => Promise<string | null> {
  const pickDirectory = window.electron?.pickDirectory
  if (!pickDirectory) {
    throw new TanzoIntegrationError(
      'ELECTRON_SYSTEM_API_UNAVAILABLE',
      'Electron system API is not available'
    )
  }
  return withDecodedIpcError(pickDirectory)
}

export const systemClient = {
  pickDirectory(args?: PickDirectoryArgs): Promise<string | null> {
    return requirePickDirectory()(args)
  }
}
