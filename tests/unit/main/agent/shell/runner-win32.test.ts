import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

const io = vi.hoisted(() => ({
  spawn: vi.fn()
}))

vi.mock('node:child_process', () => ({
  spawn: io.spawn
}))

describe('main/agent/shell/runner on Windows', () => {
  it('does not detach child shells so output and exit events can be collected', async () => {
    io.spawn.mockReset()
    io.spawn.mockImplementation(() => {
      const stdout = new PassThrough()
      const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
      const on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const existing = handlers.get(event) ?? []
        existing.push(handler)
        handlers.set(event, existing)
        return child
      })
      const child = {
        pid: 123,
        killed: false,
        stdout,
        stderr: new PassThrough(),
        on,
        kill: vi.fn()
      }

      queueMicrotask(() => {
        stdout.write('ok\n')
        stdout.end()
        for (const handler of handlers.get('close') ?? []) handler(0, null)
      })

      return child
    })

    const { createShellRunner } = await import('@main/agent/shell/runner')
    const runner = createShellRunner({ platform: 'win32', env: { ComSpec: 'cmd.exe' } })
    const events: Array<{ type: string; data?: string; code?: number; reason?: string }> = []

    for await (const event of runner.spawn('Write-Output ok', {
      cwd: process.cwd(),
      timeout: 1000
    })) {
      events.push(event)
    }

    expect(io.spawn).toHaveBeenCalledWith(
      'pwsh.exe',
      ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Write-Output ok'],
      expect.objectContaining({
        cwd: process.cwd(),
        detached: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    )
    expect(events).toEqual([
      { type: 'stdout', data: 'ok\n' },
      { type: 'exit', code: 0, reason: 'exit' }
    ])
  })
})
