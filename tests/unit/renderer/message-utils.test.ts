import { describe, expect, it } from 'vitest'
import type { TanzoUIMessage } from '@shared/agent-message'
import {
  latestCompaction,
  upsertMessage
} from '@renderer/features/chat/model/conversation/message-utils'

function textMessage(id: string, text: string): TanzoUIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }]
  }
}

function summaryMessage(summaryId: string, summary: string): TanzoUIMessage {
  return {
    id: summaryId,
    role: 'user',
    parts: [
      { type: 'text', text: summary },
      { type: 'data-compaction', data: { stage: 'complete', summaryId, summary } }
    ]
  }
}

describe('chat/conversation/message-utils latestCompaction', () => {
  it('returns the most recent compaction data part', () => {
    const messages = [
      summaryMessage('summary-1', 'first'),
      textMessage('tail-1', 'tail'),
      summaryMessage('summary-2', 'second')
    ]

    expect(latestCompaction(messages)).toMatchObject({ summaryId: 'summary-2', summary: 'second' })
  })

  it('returns null when no compaction marker exists', () => {
    expect(latestCompaction([textMessage('m1', 'plain')])).toBeNull()
  })
})

describe('chat/conversation/message-utils upsertMessage', () => {
  it('appends a new message', () => {
    const first = textMessage('m1', 'one')
    const second = textMessage('m2', 'two')

    expect(upsertMessage([first], second)).toEqual([first, second])
  })

  it('replaces an existing message by id', () => {
    const first = textMessage('m1', 'one')
    const updated = textMessage('m1', 'updated')

    expect(upsertMessage([first], updated)).toEqual([updated])
  })
})
