import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createShellRunner } from '../src/main/agent/shell/runner'
import type { ShellEvent } from '../src/main/agent/types'

async function collect(
  cmd: string,
  options: { timeout?: number; signal?: AbortSignal } = {}
): Promise<ShellEvent[]> {
  const shell = createShellRunner()
  const events: ShellEvent[] = []
  for await (const event of shell.spawn(cmd, { cwd: process.cwd(), ...options })) {
    events.push(event)
  }
  return events
}

function exitEvent(events: ShellEvent[]): ShellEvent {
  const event = events.find((item) => item.type === 'exit')
  assert.ok(event, 'expected an exit event')
  return event
}

test('shell runner returns the real exit code for completed commands', async () => {
  const events = await collect('echo hi')
  assert.deepEqual(events[0], { type: 'stdout', data: 'hi\n' })
  assert.equal(exitEvent(events).code, 0)
  assert.equal(exitEvent(events).reason, 'exit')
})

test('shell runner reports 124 only for its own timeout', async () => {
  const events = await collect('sleep 2', { timeout: 50 })
  const exit = exitEvent(events)
  assert.equal(exit.code, 124)
  assert.equal(exit.reason, 'timeout')
})

test('shell runner reports aborts separately from timeouts', async () => {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 50)

  const events = await collect('sleep 2', { signal: controller.signal })
  const exit = exitEvent(events)
  assert.equal(exit.code, 130)
  assert.equal(exit.reason, 'abort')
})
