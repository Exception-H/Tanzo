import { describe, expect, it } from 'vitest'
import { createQuestionBroker } from '@main/agent/question/broker'

const input = {
  questions: [
    {
      id: 'scope',
      title: 'Scope',
      prompt: 'Which scope?',
      type: 'single_select' as const,
      options: [
        { value: 'current', label: 'Current chat' },
        { value: 'all', label: 'All chats' }
      ]
    }
  ]
}

describe('main/agent/question/broker', () => {
  it('resolves a pending question with answers', async () => {
    const broker = createQuestionBroker()
    const promise = broker.ask('chat-1', 'call-1', input)

    await broker.respond('chat-1', 'call-1', {
      kind: 'answers',
      answers: [
        {
          id: 'scope',
          type: 'single_select',
          values: ['current'],
          labels: ['Current chat'],
          custom: false
        }
      ]
    })

    await expect(promise).resolves.toEqual({
      answers: [
        {
          id: 'scope',
          type: 'single_select',
          values: ['current'],
          labels: ['Current chat'],
          custom: false
        }
      ]
    })
    await expect(
      broker.respond('chat-1', 'call-1', {
        kind: 'answers',
        answers: [{ id: 'scope', type: 'single_select', values: ['all'], custom: false }]
      })
    ).rejects.toThrow('Question is no longer pending.')
  })

  it('accepts multiple values for multi_select questions', async () => {
    const broker = createQuestionBroker()
    const multiInput = {
      questions: [
        {
          id: 'langs',
          title: 'Languages',
          prompt: 'Which languages?',
          type: 'multi_select' as const,
          options: [
            { value: 'ts', label: 'TypeScript' },
            { value: 'py', label: 'Python' },
            { value: 'go', label: 'Go' }
          ]
        }
      ]
    }
    const promise = broker.ask('chat-1', 'call-1', multiInput)
    await broker.respond('chat-1', 'call-1', {
      kind: 'answers',
      answers: [{ id: 'langs', type: 'multi_select', values: ['ts', 'go'], custom: false }]
    })
    await expect(promise).resolves.toMatchObject({
      answers: [{ id: 'langs', values: ['ts', 'go'] }]
    })
  })

  it('resolves as declined when the user wants to discuss instead', async () => {
    const broker = createQuestionBroker()
    const promise = broker.ask('chat-1', 'call-1', input)
    await broker.respond('chat-1', 'call-1', { kind: 'declined', note: 'Let us talk first.' })
    await expect(promise).resolves.toEqual({ declined: true, note: 'Let us talk first.' })
  })

  it('resolves as declined without a note', async () => {
    const broker = createQuestionBroker()
    const promise = broker.ask('chat-1', 'call-1', input)
    await broker.respond('chat-1', 'call-1', { kind: 'declined' })
    await expect(promise).resolves.toEqual({ declined: true })
  })

  it('requires every option to be ranked for rank_priorities', async () => {
    const rankInput = {
      questions: [
        {
          id: 'order',
          title: 'Order',
          prompt: 'Rank these.',
          type: 'rank_priorities' as const,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' }
          ]
        }
      ]
    }

    const rejecting = createQuestionBroker()
    const rejected = rejecting.ask('chat-1', 'call-1', rankInput)
    await expect(
      rejecting.respond('chat-1', 'call-1', {
        kind: 'answers',
        answers: [{ id: 'order', type: 'rank_priorities', values: ['a', 'b'], custom: false }]
      })
    ).rejects.toThrow('requires ranking every option')
    await expect(rejected).rejects.toThrow('requires ranking every option')

    const accepting = createQuestionBroker()
    const accepted = accepting.ask('chat-1', 'call-1', rankInput)
    await accepting.respond('chat-1', 'call-1', {
      kind: 'answers',
      answers: [{ id: 'order', type: 'rank_priorities', values: ['c', 'a', 'b'], custom: false }]
    })
    await expect(accepted).resolves.toMatchObject({
      answers: [{ id: 'order', values: ['c', 'a', 'b'] }]
    })
  })

  it('rejects answers whose type does not match the question', async () => {
    const broker = createQuestionBroker()
    const promise = broker.ask('chat-1', 'call-1', input)
    await expect(
      broker.respond('chat-1', 'call-1', {
        kind: 'answers',
        answers: [{ id: 'scope', type: 'multi_select', values: ['current'], custom: false }]
      })
    ).rejects.toThrow('does not match')
    await expect(promise).rejects.toThrow('does not match')
  })

  it('rejects unknown option values for non-custom answers', async () => {
    const broker = createQuestionBroker()
    const promise = broker.ask('chat-1', 'call-1', input)
    await expect(
      broker.respond('chat-1', 'call-1', {
        kind: 'answers',
        answers: [{ id: 'scope', type: 'single_select', values: ['nope'], custom: false }]
      })
    ).rejects.toThrow('not a valid option')
    await expect(promise).rejects.toThrow('not a valid option')
  })

  it('rejects and clears when aborted', async () => {
    const broker = createQuestionBroker()
    const controller = new AbortController()
    const promise = broker.ask('chat-1', 'call-1', input, controller.signal)

    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await expect(
      broker.respond('chat-1', 'call-1', { kind: 'answers', answers: [] })
    ).rejects.toThrow('Question is no longer pending.')
  })
})
