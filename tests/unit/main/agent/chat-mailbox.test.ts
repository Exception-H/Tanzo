import { describe, expect, it } from 'vitest'
import { createChatMailbox } from '@main/agent/runtime/chat-mailbox'

describe('agent/runtime/chat-mailbox', () => {
  it('runs tasks for the same chat strictly in order', async () => {
    const mailbox = createChatMailbox()
    const order: number[] = []

    const slow = mailbox.enqueue('chat-1', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push(1)
    })
    const fast = mailbox.enqueue('chat-1', () => {
      order.push(2)
    })

    await Promise.all([slow, fast])
    expect(order).toEqual([1, 2])
  })

  it('keeps chats independent and survives task failures', async () => {
    const mailbox = createChatMailbox()
    const order: string[] = []

    const failing = mailbox.enqueue('chat-1', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw new Error('boom')
    })
    const other = mailbox.enqueue('chat-2', () => {
      order.push('chat-2')
    })

    await other
    expect(order).toEqual(['chat-2'])
    await expect(failing).rejects.toThrow('boom')
    await expect(mailbox.enqueue('chat-1', () => 'ok')).resolves.toBe('ok')
  })
})
