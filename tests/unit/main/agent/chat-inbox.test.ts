import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QUEUED_MESSAGE_LIMIT } from '@shared/chat'
import type { QueuedMessage } from '@shared/agent-message'
import { createChatInbox } from '@main/agent/runtime/chat-inbox'
import { createChatKeyedQueue } from '@main/agent/runtime/chat-keyed-queue'

function setup(options: { inflight: boolean }) {
  const send = vi.fn()
  const messageQueue = createChatKeyedQueue<QueuedMessage>()
  const steerQueue = createChatKeyedQueue<string>()
  const submitUserMessage = vi.fn(async () => undefined)
  const runTurn = vi.fn(async () => undefined)
  const instructTask = vi.fn()
  const deps = {
    send,
    store: { getConversation: vi.fn(() => ({ id: 'chat-1' })) }
  } as never
  const inbox = createChatInbox(
    deps,
    { messageQueue, steerQueue },
    {
      isInflight: () => options.inflight,
      runTurn,
      submitUserMessage,
      instructTask
    }
  )
  return { inbox, send, messageQueue, steerQueue, submitUserMessage }
}

describe('agent/chat-inbox queue + steer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches an enqueue immediately when idle instead of leaving it stuck', () => {
    const { inbox, submitUserMessage, messageQueue } = setup({ inflight: false })
    inbox.enqueue('chat-1', 'do it now')
    expect(submitUserMessage).toHaveBeenCalledWith('chat-1', 'do it now')
    expect(messageQueue.list('chat-1')).toEqual([])
  })

  it('queues an enqueue with a stable id and broadcasts the snapshot when inflight', () => {
    const { inbox, submitUserMessage, messageQueue, send } = setup({ inflight: true })
    inbox.enqueue('chat-1', 'later')
    expect(submitUserMessage).not.toHaveBeenCalled()
    const items = messageQueue.list('chat-1')
    expect(items).toEqual([{ id: expect.any(String), text: 'later' }])
    expect(send).toHaveBeenLastCalledWith(
      'chat-1',
      expect.objectContaining({ type: 'data-queued', data: { items }, transient: true })
    )
  })

  it('rejects an enqueue past the cap and notifies the user', () => {
    const { inbox, messageQueue, send } = setup({ inflight: true })
    for (let i = 0; i < QUEUED_MESSAGE_LIMIT; i += 1) inbox.enqueue('chat-1', `m${i}`)
    inbox.enqueue('chat-1', 'overflow')
    expect(messageQueue.list('chat-1')).toHaveLength(QUEUED_MESSAGE_LIMIT)
    expect(messageQueue.list('chat-1').some((m) => m.text === 'overflow')).toBe(false)
    expect(send).toHaveBeenLastCalledWith(
      'chat-1',
      expect.objectContaining({
        type: 'data-steering',
        data: { text: expect.stringContaining('Queue is full') }
      })
    )
  })

  it('removes a queued message by id, not position', () => {
    const { inbox, messageQueue } = setup({ inflight: true })
    inbox.enqueue('chat-1', 'a')
    inbox.enqueue('chat-1', 'b')
    inbox.enqueue('chat-1', 'c')
    const targetId = messageQueue.list('chat-1')[1].id
    inbox.removeQueued('chat-1', targetId)
    expect(messageQueue.list('chat-1').map((m) => m.text)).toEqual(['a', 'c'])
  })

  it('ignores removeQueued for an unknown id', () => {
    const { inbox, messageQueue } = setup({ inflight: true })
    inbox.enqueue('chat-1', 'a')
    inbox.removeQueued('chat-1', 'missing')
    expect(messageQueue.list('chat-1').map((m) => m.text)).toEqual(['a'])
  })

  it('dispatches a steer as a normal message when idle', () => {
    const { inbox, submitUserMessage, steerQueue } = setup({ inflight: false })
    inbox.steer('chat-1', 'redirect')
    expect(submitUserMessage).toHaveBeenCalledWith('chat-1', 'redirect')
    expect(steerQueue.list('chat-1')).toEqual([])
  })

  it('pushes a steer onto the steer queue and echoes it when inflight', () => {
    const { inbox, submitUserMessage, steerQueue, send } = setup({ inflight: true })
    inbox.steer('chat-1', 'redirect')
    expect(submitUserMessage).not.toHaveBeenCalled()
    expect(steerQueue.list('chat-1')).toEqual(['redirect'])
    expect(send).toHaveBeenLastCalledWith(
      'chat-1',
      expect.objectContaining({ type: 'data-steering', data: { text: 'redirect' } })
    )
  })
})
