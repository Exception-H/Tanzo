import { describe, expect, it } from 'vitest'
import { CHAT_CHANNELS, chatEventChannel } from '@shared/chat'

describe('shared/agent', () => {
  it('derives per-chat event channels from the shared channel constants', () => {
    expect(chatEventChannel('chat-123')).toBe(`${CHAT_CHANNELS.event}:chat-123`)
  })
})
