import { describe, expect, it } from 'vitest'
import { createSignalQueue } from '@main/agent/runtime/signal-queue'

describe('agent/runtime/signal-queue', () => {
  it('resolves next() once per signal and false after close', async () => {
    const queue = createSignalQueue()
    queue.signal()
    await expect(queue.next()).resolves.toBe(true)
    queue.close()
    await expect(queue.next()).resolves.toBe(false)
  })

  it('coalesces multiple signals received before the consumer wakes', async () => {
    const queue = createSignalQueue()
    queue.signal()
    queue.signal()
    queue.signal()
    await expect(queue.next()).resolves.toBe(true)
    queue.close()
    await expect(queue.next()).resolves.toBe(false)
  })

  it('wakes a pending consumer when a signal arrives', async () => {
    const queue = createSignalQueue()
    const pending = queue.next()
    queue.signal()
    await expect(pending).resolves.toBe(true)
  })

  it('wakes a pending consumer with false when closed', async () => {
    const queue = createSignalQueue()
    const pending = queue.next()
    queue.close()
    await expect(pending).resolves.toBe(false)
  })

  it('drains a buffered signal before reporting closed', async () => {
    const queue = createSignalQueue()
    queue.signal()
    queue.close()
    await expect(queue.next()).resolves.toBe(true)
    await expect(queue.next()).resolves.toBe(false)
  })
})
