import { describe, expect, it, vi } from 'vitest'
import { SLASH_COMMAND_CHANNELS } from '@shared/slash-command'
import { registerSlashCommandIpc } from '@main/slash-command/ipc'

type Handler = (_event: unknown, ...args: unknown[]) => unknown

function ipcTarget() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    target: {
      handle: vi.fn((channel: string, handler: Handler) => {
        handlers.set(channel, handler)
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel)
      })
    }
  }
}

describe('main/slash-command/ipc', () => {
  it('registers a list handler that validates workspace roots and delegates', async () => {
    const service = {
      listCommands: vi.fn((workspaceRoot: string) => [
        { name: 'review', kind: 'prompt', source: 'command', template: workspaceRoot }
      ])
    }
    const { handlers, target } = ipcTarget()

    const unregister = registerSlashCommandIpc(target as never, service as never)

    expect(target.removeHandler).toHaveBeenCalledWith(SLASH_COMMAND_CHANNELS.list)
    expect(target.handle).toHaveBeenCalledWith(SLASH_COMMAND_CHANNELS.list, expect.any(Function))
    expect(handlers.get(SLASH_COMMAND_CHANNELS.list)?.(null, '/workspace')).toEqual([
      { name: 'review', kind: 'prompt', source: 'command', template: '/workspace' }
    ])
    expect(service.listCommands).toHaveBeenCalledWith('/workspace')
    expect(() => handlers.get(SLASH_COMMAND_CHANNELS.list)?.(null, '')).toThrow()

    unregister()
    expect(target.removeHandler).toHaveBeenCalledTimes(2)
  })
})
