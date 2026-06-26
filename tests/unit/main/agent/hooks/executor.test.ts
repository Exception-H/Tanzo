import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { createHookExecutor } from '@main/agent/hooks/executor'

const executor = createHookExecutor()
const isWindows = process.platform === 'win32'

describe.skipIf(isWindows)('main/agent/hooks/executor (stdin round-trip)', () => {
  it('writes the payload to stdin and captures stdout + exit code', async () => {
    const result = await executor.run({
      command: 'cat',
      stdin: '{"hello":"world"}',
      cwd: tmpdir(),
      timeoutSec: 10
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('{"hello":"world"}')
    expect(result.timedOut).toBe(false)
    expect(result.error).toBeUndefined()
  })

  it('captures stderr and a non-zero exit code', async () => {
    const result = await executor.run({
      command: 'echo oops 1>&2; exit 2',
      stdin: '{}',
      cwd: tmpdir(),
      timeoutSec: 10
    })
    expect(result.exitCode).toBe(2)
    expect(result.stderr.trim()).toBe('oops')
  })

  it('runs in the given cwd', async () => {
    const result = await executor.run({
      command: 'pwd',
      stdin: '',
      cwd: tmpdir(),
      timeoutSec: 10
    })
    expect(result.stdout.trim().length).toBeGreaterThan(0)
    expect(result.exitCode).toBe(0)
  })

  it('enforces the timeout and reports it', async () => {
    const result = await executor.run({
      command: 'sleep 5',
      stdin: '',
      cwd: tmpdir(),
      timeoutSec: 1
    })
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBeNull()
    expect(result.error).toMatch(/timed out/)
  })

  it('reports a spawn error for a missing shell gracefully', async () => {
    const result = await executor.run({
      command: 'exit 3',
      stdin: '',
      cwd: tmpdir(),
      timeoutSec: 10
    })
    expect(result.exitCode).toBe(3)
  })
})
