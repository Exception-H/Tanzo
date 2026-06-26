import { describe, expect, it, vi } from 'vitest'
import type { UIMessageChunk } from 'ai'
import type { ChatEvent, ChatRunFrame, ChatRunSnapshot, ChatRunStatus } from '@shared/chat'
import type { TanzoUIMessage } from '@shared/agent-message'
import {
  connectRun,
  createFrameGate,
  createMessageSink
} from '@renderer/platform/electron/run-stream'

function frame(runId: string, seq: number, chunk: UIMessageChunk): ChatRunFrame {
  return { kind: 'run-frame', chatId: 'chat-1', runId, seq, chunk }
}

function telemetryChunk(id: string): UIMessageChunk {
  return {
    type: 'data-telemetry',
    id,
    transient: true,
    data: {
      event: 'retry-attempt',
      runId: 'run-1',
      scope: 'chat',
      sequence: 1,
      timestamp: 1,
      retry: { attempt: 2 }
    }
  } as never
}

function state(runId: string, status: ChatRunStatus): ChatEvent {
  return { kind: 'run-state', chatId: 'chat-1', runId, runKind: 'chat', status }
}

function makeApi(snapshot: ChatRunSnapshot | null) {
  const listeners = new Set<(event: ChatEvent) => void>()
  return {
    listeners,
    emit(event: ChatEvent) {
      for (const listener of listeners) listener(event)
    },
    api: {
      onEvent: vi.fn((_chatId: string, listener: (event: ChatEvent) => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }),
      runSnapshot: vi.fn(async () => snapshot)
    }
  }
}

const base: TanzoUIMessage[] = []

describe('createMessageSink', () => {
  function drainSink(
    chunks: UIMessageChunk[],
    seedMessage?: TanzoUIMessage
  ): Promise<TanzoUIMessage[]> {
    return new Promise((resolve) => {
      const seen: TanzoUIMessage[] = []
      const sink = createMessageSink({
        onMessage: (message) => seen.push(structuredClone(message)),
        onSettled: () => resolve(seen),
        ...(seedMessage ? { seedMessage } : {})
      })
      for (const chunk of chunks) sink.enqueue(chunk)
      sink.close()
    })
  }

  const resumeChunks: UIMessageChunk[] = [
    { type: 'start', messageId: 'asst-1' } as never,
    {
      type: 'tool-output-available',
      toolCallId: 'c1',
      output: { stdout: 'ok', stderr: '', code: 0 }
    } as never,
    { type: 'text-start', id: 't1' } as never,
    { type: 'text-delta', id: 't1', delta: 'Done.' } as never,
    { type: 'text-end', id: 't1' } as never,
    { type: 'finish' } as never
  ]

  const approvedMessage: TanzoUIMessage = {
    id: 'asst-1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-shell',
        toolCallId: 'c1',
        state: 'approval-responded',
        input: { command: 'ls' },
        approval: { id: 'ap1', approved: true }
      }
    ]
  } as never

  it('collapses a resumed assistant message to empty parts without a seed', async () => {
    const messages = await drainSink(resumeChunks)
    const last = messages.at(-1)
    expect(last?.id).toBe('asst-1')
    expect(last?.parts).toEqual([])
  })

  it('rebuilds a resumed assistant message onto its seeded parts', async () => {
    const messages = await drainSink(resumeChunks, approvedMessage)
    const last = messages.at(-1)
    expect(last?.id).toBe('asst-1')
    expect(last?.parts).toEqual([
      {
        type: 'tool-shell',
        toolCallId: 'c1',
        state: 'output-available',
        input: { command: 'ls' },
        approval: { id: 'ap1', approved: true },
        output: { stdout: 'ok', stderr: '', code: 0 }
      },
      { type: 'text', text: 'Done.', state: 'done' }
    ])
  })
})

describe('createFrameGate', () => {
  it('rejects frames from other runs and out-of-order seqs', () => {
    const gate = createFrameGate()
    gate.lock('run-1')
    expect(gate.accept(frame('run-1', 1, { type: 'start', messageId: 'a' }))).toBe(true)
    expect(gate.accept(frame('run-2', 2, { type: 'text-start', id: 't' } as never))).toBe(false)
    expect(gate.accept(frame('run-1', 1, { type: 'finish' }))).toBe(false)
    expect(gate.accept(frame('run-1', 2, { type: 'finish' }))).toBe(true)
  })
})

describe('connectRun', () => {
  it('replays snapshot notifications and frames before live frames', async () => {
    const snapshot: ChatRunSnapshot = {
      chatId: 'chat-1',
      runId: 'run-1',
      runKind: 'chat',
      status: 'running',
      baseMessages: base,
      notifications: [
        { type: 'data-compaction', id: 'compaction:run-1', data: { stage: 'start' } } as never
      ],
      frames: [frame('run-1', 1, { type: 'start', messageId: 'a' })]
    }
    const harness = makeApi(snapshot)
    const chunks: UIMessageChunk[] = []

    const connection = await connectRun(harness.api, 'chat-1', {
      onChunk: (chunk) => chunks.push(chunk)
    })
    expect(connection).not.toBeNull()

    harness.emit(frame('run-1', 2, { type: 'finish' }))
    harness.emit(state('run-1', 'finished'))

    expect(chunks).toEqual([
      { type: 'data-compaction', id: 'compaction:run-1', data: { stage: 'start' } },
      { type: 'start', messageId: 'a' },
      { type: 'finish' }
    ])
  })

  it('replays snapshot frames then live frames in order, deduped by seq', async () => {
    const snapshot: ChatRunSnapshot = {
      chatId: 'chat-1',
      runId: 'run-1',
      runKind: 'chat',
      status: 'running',
      baseMessages: base,
      notifications: [],
      frames: [frame('run-1', 1, { type: 'start', messageId: 'a' })]
    }
    const harness = makeApi(snapshot)
    const chunks: UIMessageChunk[] = []

    harness.emit(frame('run-1', 1, { type: 'start', messageId: 'a' }))

    const connection = await connectRun(harness.api, 'chat-1', {
      onChunk: (chunk) => chunks.push(chunk)
    })
    expect(connection).not.toBeNull()

    harness.emit(frame('run-1', 2, { type: 'finish' }))
    harness.emit(state('run-1', 'finished'))

    expect(chunks).toEqual([{ type: 'start', messageId: 'a' }, { type: 'finish' }])
    expect(harness.listeners.size).toBe(0)
  })

  it('does not replay telemetry data frames from snapshots', async () => {
    const oldTelemetry = telemetryChunk('old-retry')
    const liveTelemetry = telemetryChunk('live-retry')
    const snapshot: ChatRunSnapshot = {
      chatId: 'chat-1',
      runId: 'run-1',
      runKind: 'chat',
      status: 'running',
      baseMessages: base,
      notifications: [],
      frames: [
        frame('run-1', 1, oldTelemetry),
        frame('run-1', 2, { type: 'start', messageId: 'a' })
      ]
    }
    const harness = makeApi(snapshot)
    const chunks: UIMessageChunk[] = []

    const connection = await connectRun(harness.api, 'chat-1', {
      onChunk: (chunk) => chunks.push(chunk)
    })
    expect(connection).not.toBeNull()

    expect(chunks).toEqual([{ type: 'start', messageId: 'a' }])

    harness.emit(frame('run-1', 3, liveTelemetry))
    harness.emit(state('run-1', 'finished'))

    expect(chunks).toEqual([{ type: 'start', messageId: 'a' }, liveTelemetry])
  })

  it('returns null and unsubscribes when there is no active run', async () => {
    const harness = makeApi(null)
    const connection = await connectRun(harness.api, 'chat-1', { onChunk: () => {} })
    expect(connection).toBeNull()
    expect(harness.listeners.size).toBe(0)
  })

  it('drops stale-run frames after locking onto the snapshot run', async () => {
    const snapshot: ChatRunSnapshot = {
      chatId: 'chat-1',
      runId: 'run-2',
      runKind: 'chat',
      status: 'running',
      baseMessages: base,
      notifications: [],
      frames: []
    }
    const harness = makeApi(snapshot)
    const chunks: UIMessageChunk[] = []
    const connection = await connectRun(harness.api, 'chat-1', {
      onChunk: (chunk) => chunks.push(chunk)
    })
    expect(connection).not.toBeNull()

    harness.emit(frame('run-1', 5, { type: 'start', messageId: 'stale' }))
    harness.emit(frame('run-2', 6, { type: 'finish' }))
    harness.emit(state('run-2', 'finished'))

    expect(chunks).toEqual([{ type: 'finish' }])
  })

  it('settles persistent runs when terminal arrives before a missing snapshot resolves', async () => {
    const harness = makeApi(null)
    const settled = vi.fn()
    const connection = await connectRun(harness.api, 'chat-1', {
      persistent: true,
      onChunk: () => {},
      onSettled: settled
    })
    expect(connection).not.toBeNull()

    let resolveSnapshot: (snapshot: ChatRunSnapshot | null) => void = () => {}
    const snapshotPromise = new Promise<ChatRunSnapshot | null>((resolve) => {
      resolveSnapshot = resolve
    })
    harness.api.runSnapshot.mockReturnValueOnce(snapshotPromise)
    harness.emit(state('run-race', 'running'))
    harness.emit(state('run-race', 'finished'))
    resolveSnapshot(null)
    await Promise.resolve()
    await Promise.resolve()

    expect(settled).toHaveBeenCalledTimes(1)
    expect(harness.listeners.size).toBe(1)
    connection?.close()
  })

  it('persistent connection re-attaches on a later run', async () => {
    const harness = makeApi(null)
    const starts: string[] = []
    const chunks: UIMessageChunk[] = []
    const connection = await connectRun(harness.api, 'chat-1', {
      persistent: true,
      onRunStart: (snapshot) => starts.push(snapshot.runId),
      onChunk: (chunk) => chunks.push(chunk)
    })
    expect(connection).not.toBeNull()

    harness.api.runSnapshot.mockResolvedValueOnce({
      chatId: 'chat-1',
      runId: 'run-9',
      runKind: 'chat',
      status: 'running',
      baseMessages: base,
      notifications: [],
      frames: [frame('run-9', 1, { type: 'start', messageId: 'x' })]
    })
    harness.emit(state('run-9', 'running'))
    await Promise.resolve()
    await Promise.resolve()
    harness.emit(frame('run-9', 2, { type: 'finish' }))
    harness.emit(state('run-9', 'finished'))

    expect(starts).toEqual(['run-9'])
    expect(chunks).toEqual([{ type: 'start', messageId: 'x' }, { type: 'finish' }])
    expect(harness.listeners.size).toBe(1)
    connection?.close()
    expect(harness.listeners.size).toBe(0)
  })
})
