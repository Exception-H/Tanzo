import { describe, expect, it } from 'vitest'
import { createChatKeyedQueue } from '@main/agent/runtime/chat-keyed-queue'

describe('agent/chat-keyed-queue', () => {
  it('drains queued items in FIFO order and clears after drain', () => {
    const queue = createChatKeyedQueue<string>()

    queue.push('chat-1', 'first')
    queue.push('chat-1', 'second')
    queue.push('chat-2', 'other')

    expect(queue.drain('chat-1')).toEqual(['first', 'second'])
    expect(queue.drain('chat-1')).toEqual([])
    expect(queue.drain('chat-2')).toEqual(['other'])
  })

  it('lists queued items in FIFO order without consuming them', () => {
    const queue = createChatKeyedQueue<string>()

    queue.push('chat-1', 'first')
    queue.push('chat-1', 'second')

    expect(queue.list('chat-1')).toEqual(['first', 'second'])
    expect(queue.list('chat-1')).toEqual(['first', 'second'])
  })

  it('shifts the oldest item and drops the chat entry when empty', () => {
    const queue = createChatKeyedQueue<string>()

    queue.push('chat-1', 'first')
    queue.push('chat-1', 'second')

    expect(queue.shift('chat-1')).toBe('first')
    expect(queue.shift('chat-1')).toBe('second')
    expect(queue.shift('chat-1')).toBeUndefined()
    expect(queue.list('chat-1')).toEqual([])
  })

  it('removes a queued item by index and ignores out-of-range indices', () => {
    const queue = createChatKeyedQueue<string>()

    queue.push('chat-1', 'a')
    queue.push('chat-1', 'b')
    queue.push('chat-1', 'c')

    queue.removeAt('chat-1', 1)
    expect(queue.list('chat-1')).toEqual(['a', 'c'])

    queue.removeAt('chat-1', 9)
    expect(queue.list('chat-1')).toEqual(['a', 'c'])

    queue.removeAt('chat-1', -1)
    expect(queue.list('chat-1')).toEqual(['a', 'c'])
  })

  it('clears all queued items for a chat', () => {
    const queue = createChatKeyedQueue<string>()

    queue.push('chat-1', 'discard me')
    queue.clear('chat-1')

    expect(queue.list('chat-1')).toEqual([])
    expect(queue.drain('chat-1')).toEqual([])
    expect(queue.shift('chat-1')).toBeUndefined()
  })
})
