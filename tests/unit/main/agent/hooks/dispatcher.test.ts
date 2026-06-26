import { describe, expect, it, vi } from 'vitest'
import { createHookDispatcher } from '@main/agent/hooks/dispatcher'
import type { HookEntry, HookExecResult, PreToolUseInput } from '@main/agent/hooks/types'
import type { HookExecutor } from '@main/agent/hooks/executor'

function entry(overrides: Partial<HookEntry> & { key: string }): HookEntry {
  return {
    event: 'PreToolUse',
    matcher: null,
    matches: () => true,
    command: 'echo',
    timeoutSec: 10,
    source: 'project',
    displayOrder: 0,
    contentHash: 'hash',
    ...overrides
  }
}

function payload(): PreToolUseInput {
  return {
    hook_event_name: 'PreToolUse',
    session_id: 's',
    turn_id: 't',
    transcript_path: null,
    cwd: '/tmp',
    model: 'm',
    permission_mode: 'default',
    tool_name: 'shell',
    tool_input: {},
    tool_use_id: 'u'
  }
}

function executorReturning(results: Record<string, Partial<HookExecResult>>): HookExecutor {
  return {
    run: vi.fn(async (options) => {
      const base: HookExecResult = {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 1,
        timedOut: false
      }
      return { ...base, ...(results[options.command] ?? {}) }
    })
  }
}

describe('main/agent/hooks/dispatcher', () => {
  it('returns an empty outcome when no handler matches', async () => {
    const dispatcher = createHookDispatcher({
      executor: executorReturning({}),
      activeEntries: () => [entry({ key: 'a', matches: () => false })]
    })
    const outcome = await dispatcher.run({
      event: 'PreToolUse',
      matchValues: ['shell'],
      payload: payload(),
      cwd: '/tmp'
    })
    expect(outcome.denied).toBe(false)
    expect(outcome.entries).toEqual([])
  })

  it('any deny wins (conservative aggregation)', async () => {
    const dispatcher = createHookDispatcher({
      executor: executorReturning({
        allow: { exitCode: 0, stdout: '' },
        deny: { exitCode: 2, stderr: 'blocked' }
      }),
      activeEntries: () => [
        entry({ key: 'a', command: 'allow', displayOrder: 0 }),
        entry({ key: 'b', command: 'deny', displayOrder: 1 })
      ]
    })
    const outcome = await dispatcher.run({
      event: 'PreToolUse',
      matchValues: ['shell'],
      payload: payload(),
      cwd: '/tmp'
    })
    expect(outcome.denied).toBe(true)
    expect(outcome.denyReason).toBe('blocked')
  })

  it('accumulates additionalContext from multiple handlers', async () => {
    const dispatcher = createHookDispatcher({
      executor: executorReturning({
        one: {
          stdout: JSON.stringify({
            hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'first' }
          })
        },
        two: {
          stdout: JSON.stringify({
            hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'second' }
          })
        }
      }),
      activeEntries: () => [
        entry({ key: 'a', event: 'SessionStart', command: 'one', displayOrder: 0 }),
        entry({ key: 'b', event: 'SessionStart', command: 'two', displayOrder: 1 })
      ]
    })
    const outcome = await dispatcher.run({
      event: 'SessionStart',
      matchValues: ['startup'],
      payload: { ...payload(), hook_event_name: 'SessionStart' } as never,
      cwd: '/tmp'
    })
    expect(outcome.additionalContext).toEqual(['first', 'second'])
  })

  it('only runs handlers for the requested event', async () => {
    const run = vi.fn(async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
      durationMs: 1,
      timedOut: false
    }))
    const dispatcher = createHookDispatcher({
      executor: { run },
      activeEntries: () => [
        entry({ key: 'a', event: 'PostToolUse', command: 'post' }),
        entry({ key: 'b', event: 'PreToolUse', command: 'pre' })
      ]
    })
    await dispatcher.run({
      event: 'PreToolUse',
      matchValues: ['shell'],
      payload: payload(),
      cwd: '/tmp'
    })
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0].command).toBe('pre')
  })
})
