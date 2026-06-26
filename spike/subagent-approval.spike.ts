import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyApprovalResponse,
  extractPendingApprovals,
  lastAssistantText
} from '../src/main/agent/subagent-approval'
import type { TanzoUIMessage } from '../src/shared/agent'

function msgWithApproval(approvalId: string): TanzoUIMessage {
  return {
    id: 'a1',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'I need to write a file.' },
      {
        type: 'tool-fileWrite',
        toolCallId: 'call-1',
        state: 'approval-requested',
        input: { path: '/tmp/x', content: 'hi' },
        approval: { id: approvalId }
      }
    ]
  } as unknown as TanzoUIMessage
}

test('extractPendingApprovals — finds approval-requested parts in last assistant msg', () => {
  const pending = extractPendingApprovals([msgWithApproval('appr-1')])
  assert.equal(pending.length, 1)
  assert.equal(pending[0].approvalId, 'appr-1')
  assert.equal(pending[0].toolName, 'fileWrite')
  assert.deepEqual(pending[0].input, { path: '/tmp/x', content: 'hi' })
})

test('extractPendingApprovals — empty when terminal (no pending tool parts)', () => {
  const terminal: TanzoUIMessage = {
    id: 'a1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'All done.' }]
  } as TanzoUIMessage
  assert.deepEqual(extractPendingApprovals([terminal]), [])
})

test('applyApprovalResponse — flips matching part to approval-responded', () => {
  const { messages, toolName, input } = applyApprovalResponse(
    [msgWithApproval('appr-1')],
    'appr-1',
    true,
    'looks safe'
  )
  assert.equal(toolName, 'fileWrite')
  assert.deepEqual(input, { path: '/tmp/x', content: 'hi' })

  const part = messages[0].parts[1] as Record<string, unknown>
  assert.equal(part.state, 'approval-responded')
  assert.deepEqual(part.approval, { id: 'appr-1', approved: true, reason: 'looks safe' })

  assert.deepEqual(extractPendingApprovals(messages), [])
})

test('applyApprovalResponse — leaves non-matching approvals untouched', () => {
  const { messages, toolName } = applyApprovalResponse(
    [msgWithApproval('appr-1')],
    'different-id',
    true
  )
  assert.equal(toolName, undefined)
  assert.equal((messages[0].parts[1] as Record<string, unknown>).state, 'approval-requested')
})

test('lastAssistantText — joins text parts of the final assistant message', () => {
  const messages: TanzoUIMessage[] = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Part one.' },
        { type: 'text', text: 'Part two.' }
      ]
    }
  ] as TanzoUIMessage[]
  assert.equal(lastAssistantText(messages), 'Part one.\n\nPart two.')
})
