import { describe, expect, it } from 'vitest'
import type { TanzoUIMessage } from '@shared/agent-message'
import { stripIncompleteInputToolParts } from '@main/agent/runtime/sanitize-messages'

describe('agent/runtime/sanitize-messages', () => {
  it('strips incomplete input-only tool parts and keeps finished ones', () => {
    const user: TanzoUIMessage = {
      id: 'm1',
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }]
    }
    const assistantWithStaleQuestion = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Need one detail.' },
        {
          type: 'tool-askQuestion',
          toolCallId: 'question-1',
          state: 'input-available',
          input: {
            questions: [
              {
                id: 'scope',
                title: 'Scope',
                prompt: 'Which scope?',
                type: 'single_select',
                options: [
                  { value: 'current', label: 'Current chat' },
                  { value: 'all', label: 'All chats' }
                ]
              }
            ]
          }
        },
        {
          type: 'tool-grep',
          toolCallId: 'grep-1',
          state: 'output-available',
          input: { pattern: 'TODO' },
          output: { mode: 'files', files: [], truncated: false }
        }
      ]
    } satisfies TanzoUIMessage

    expect(stripIncompleteInputToolParts([assistantWithStaleQuestion, user])).toEqual([
      {
        ...assistantWithStaleQuestion,
        parts: [
          { type: 'text', text: 'Need one detail.' },
          {
            type: 'tool-grep',
            toolCallId: 'grep-1',
            state: 'output-available',
            input: { pattern: 'TODO' },
            output: { mode: 'files', files: [], truncated: false }
          }
        ]
      },
      user
    ])
  })

  it('drops assistant messages left with no parts and keeps untouched messages by reference', () => {
    const untouched: TanzoUIMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'done' }]
    }
    const onlyStreaming = {
      id: 'a2',
      role: 'assistant',
      parts: [
        {
          type: 'tool-shell',
          toolCallId: 'call-1',
          state: 'input-streaming',
          input: { command: 'ls' }
        }
      ]
    } satisfies TanzoUIMessage

    const result = stripIncompleteInputToolParts([untouched, onlyStreaming])
    expect(result).toEqual([untouched])
    expect(result[0]).toBe(untouched)
  })
})
