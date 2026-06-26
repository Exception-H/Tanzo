import { describe, expect, it } from 'vitest'
import { createRunEngine } from '@main/agent/runtime/run-engine'

describe('agent/runtime/run-engine', () => {
  it('tracks the inflight owner and releases only the owning controller', () => {
    const engine = createRunEngine()
    const first = engine.beginRun('chat-1')
    expect(engine.isOwner('chat-1', first.controller)).toBe(true)
    expect(engine.isRunning('chat-1')).toBe(true)
    expect(engine.listRunning()).toEqual(['chat-1'])

    const second = engine.beginRun('chat-1')
    expect(first.controller.signal.aborted).toBe(true)
    expect(engine.isOwner('chat-1', first.controller)).toBe(false)
    expect(engine.isOwner('chat-1', second.controller)).toBe(true)

    expect(engine.releaseIfOwner('chat-1', first.controller)).toBe(false)
    expect(engine.isRunning('chat-1')).toBe(true)
    expect(engine.releaseIfOwner('chat-1', second.controller)).toBe(true)
    expect(engine.isRunning('chat-1')).toBe(false)
  })

  it('advances the run epoch on every begin and abort', () => {
    const engine = createRunEngine()
    expect(engine.currentEpoch('chat-1')).toBe(0)
    engine.beginRun('chat-1')
    expect(engine.currentEpoch('chat-1')).toBe(1)
    engine.abort('chat-1')
    expect(engine.currentEpoch('chat-1')).toBe(2)
  })

  it('detects supersede via hasAdvancedSince after a new run begins or abort fires', () => {
    const engine = createRunEngine()
    const first = engine.beginRun('chat-1')
    expect(engine.hasAdvancedSince('chat-1', first.epoch)).toBe(false)
    const second = engine.beginRun('chat-1')
    expect(engine.hasAdvancedSince('chat-1', first.epoch)).toBe(true)
    expect(engine.hasAdvancedSince('chat-1', second.epoch)).toBe(false)
    engine.abort('chat-1')
    expect(engine.hasAdvancedSince('chat-1', second.epoch)).toBe(true)
  })

  it('links a parent abort signal to the run controller', () => {
    const engine = createRunEngine()
    const parent = new AbortController()
    const run = engine.beginRun('chat-1', parent.signal)
    expect(run.controller.signal.aborted).toBe(false)
    parent.abort()
    expect(run.controller.signal.aborted).toBe(true)
  })

  it('aborts immediately when the parent signal is already aborted', () => {
    const engine = createRunEngine()
    const parent = new AbortController()
    parent.abort()
    const run = engine.beginRun('chat-1', parent.signal)
    expect(run.controller.signal.aborted).toBe(true)
  })

  it('counts preparing and inflight chats as running', () => {
    const engine = createRunEngine()
    const prep = new AbortController()
    engine.setPreparing('chat-1', prep)
    expect(engine.isRunning('chat-1')).toBe(true)
    expect(engine.listRunning()).toEqual(['chat-1'])
    engine.clearPreparing('chat-1', prep)
    expect(engine.isRunning('chat-1')).toBe(false)
  })

  it('aborts both preparing and inflight controllers and bumps the epoch', () => {
    const engine = createRunEngine()
    const prep = new AbortController()
    engine.setPreparing('chat-1', prep)
    const run = engine.beginRun('chat-1')
    const epochBefore = engine.currentEpoch('chat-1')
    engine.abort('chat-1')
    expect(prep.signal.aborted).toBe(true)
    expect(run.controller.signal.aborted).toBe(true)
    expect(engine.currentEpoch('chat-1')).toBe(epochBefore + 1)
  })

  it('monotonically bumps the cancel generation independently of the epoch', () => {
    const engine = createRunEngine()
    expect(engine.currentCancelGeneration('chat-1')).toBe(0)
    expect(engine.bumpCancelGeneration('chat-1')).toBe(1)
    expect(engine.currentCancelGeneration('chat-1')).toBe(1)
    engine.beginRun('chat-1')
    expect(engine.currentCancelGeneration('chat-1')).toBe(1)
  })

  it('settles once all tracked runs resolve', async () => {
    const engine = createRunEngine()
    let resolve!: () => void
    engine.track(
      new Promise<void>((r) => {
        resolve = r
      })
    )
    const blocked = await engine.settle(20)
    expect(blocked).toBe(false)
    resolve()
    const settled = await engine.settle(100)
    expect(settled).toBe(true)
  })

  it('emits running then a derived terminal through the run lifecycle', async () => {
    const events: Array<{ status: string; runKind: string }> = []
    const engine = createRunEngine({
      streams: {
        start: (_chatId, _runId, _base, options) => {
          events.push({ status: 'running', runKind: options?.runKind ?? 'chat' })
          return undefined as never
        },
        finish: (_chatId, _runId, status) => {
          events.push({ status, runKind: 'n/a' })
          return null
        }
      }
    })

    const result = await engine.run(
      { chatId: 'chat-1', runId: 'run-1', kind: 'compaction', baseMessages: [] },
      async () => 'ok'
    )

    expect(result).toBe('ok')
    expect(events).toEqual([
      { status: 'running', runKind: 'compaction' },
      { status: 'finished', runKind: 'n/a' }
    ])
    expect(engine.isRunning('chat-1')).toBe(false)
  })

  it('reports aborted when the run is cancelled mid-body', async () => {
    const finished: string[] = []
    const engine = createRunEngine({
      streams: {
        start: () => undefined as never,
        finish: (_chatId, _runId, status) => {
          finished.push(status)
          return null
        }
      }
    })

    await expect(
      engine.run(
        { chatId: 'chat-1', runId: 'run-1', kind: 'compaction', baseMessages: [] },
        async (handle) => {
          engine.abort('chat-1')
          if (handle.signal.aborted) throw new Error('aborted')
          return 'never'
        }
      )
    ).rejects.toThrow()
    expect(finished).toEqual(['aborted'])
  })

  it('derives the terminal from resolveTerminal on normal completion', async () => {
    const finished: Array<{ status: string; code?: string }> = []
    const engine = createRunEngine({
      streams: {
        start: () => undefined as never,
        finish: (_chatId, _runId, status, error) => {
          finished.push({ status, ...(error ? { code: error.code } : {}) })
          return null
        }
      }
    })

    await engine.run(
      {
        chatId: 'chat-1',
        runId: 'run-1',
        kind: 'chat',
        baseMessages: [],
        resolveTerminal: () => ({ status: 'failed', error: { code: 'X', message: 'boom' } })
      },
      async () => 'done'
    )
    expect(finished).toEqual([{ status: 'failed', code: 'X' }])
  })

  it('defers the terminal emission on normal completion when deferTerminal is set', async () => {
    const finished: string[] = []
    const engine = createRunEngine({
      streams: {
        start: () => undefined as never,
        finish: (_chatId, _runId, status) => {
          finished.push(status)
          return null
        }
      }
    })

    await engine.run(
      { chatId: 'chat-1', runId: 'run-1', kind: 'chat', baseMessages: [], deferTerminal: true },
      async () => 'done'
    )
    expect(finished).toEqual([])
  })

  it('emits the terminal even when deferred if the body throws', async () => {
    const finished: string[] = []
    const engine = createRunEngine({
      streams: {
        start: () => undefined as never,
        finish: (_chatId, _runId, status) => {
          finished.push(status)
          return null
        }
      }
    })

    await expect(
      engine.run(
        { chatId: 'chat-1', runId: 'run-1', kind: 'chat', baseMessages: [], deferTerminal: true },
        async () => {
          throw new Error('setup failed')
        }
      )
    ).rejects.toThrow('setup failed')
    expect(finished).toEqual(['failed'])
  })

  it('invokes onStart synchronously with the run handle before the body awaits', async () => {
    const engine = createRunEngine()
    let startedEpoch: number | undefined
    await engine.run(
      {
        chatId: 'chat-1',
        runId: 'run-1',
        kind: 'chat',
        baseMessages: [],
        onStart: (handle) => {
          startedEpoch = handle.epoch
        }
      },
      async (handle) => {
        expect(handle.epoch).toBe(startedEpoch)
        expect(handle.isCurrent()).toBe(true)
        return 'ok'
      }
    )
    expect(startedEpoch).toBe(1)
  })
})
