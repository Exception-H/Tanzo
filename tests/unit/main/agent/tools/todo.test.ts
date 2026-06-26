import { describe, expect, it, vi } from 'vitest'
import type { ToolDeps } from '@main/agent/tools/types'
import type { TanzoTools, TanzoUIMessage } from '@shared/agent-message'
import { todoTool } from '@main/agent/tools/todo'

type TodoInput = TanzoTools['todo']['input']

function deps(previous: TanzoUIMessage[] = []): ToolDeps {
  return {
    store: { load: vi.fn(async () => previous) }
  } as unknown as ToolDeps
}

function run(d: ToolDeps, input: TodoInput): Promise<TanzoTools['todo']['output']> {
  return (
    todoTool(d, 'chat-1') as unknown as {
      execute: (input: TodoInput) => Promise<TanzoTools['todo']['output']>
    }
  ).execute(input)
}

function todoMessage(items: TodoInput['items']): TanzoUIMessage {
  return {
    id: 'm1',
    role: 'assistant',
    parts: [{ type: 'tool-todo', toolCallId: 'c1', state: 'output-available', input: { items } }]
  } as unknown as TanzoUIMessage
}

function todoMessageWithOutput(
  inputItems: TodoInput['items'],
  outputItems: TodoInput['items']
): TanzoUIMessage {
  return {
    id: 'm1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-todo',
        toolCallId: 'c1',
        state: 'output-available',
        input: { items: inputItems },
        output: {
          ok: true,
          items: outputItems,
          counts: { pending: 0, in_progress: 1, completed: 0 }
        }
      }
    ]
  } as unknown as TanzoUIMessage
}

describe('main/agent/tools/todo', () => {
  it('counts items by status', async () => {
    const output = await run(deps(), {
      items: [
        { content: 'a', status: 'completed' },
        { content: 'b', status: 'in_progress' },
        { content: 'c', status: 'pending' },
        { content: 'd', status: 'pending' }
      ]
    })

    expect(output).toMatchObject({ ok: true, counts: { pending: 2, in_progress: 1, completed: 1 } })
    if ('ok' in output && output.ok) expect(output.items).toHaveLength(4)
  })

  it('demotes extra in_progress items to pending and reports it', async () => {
    const output = await run(deps(), {
      items: [
        { content: 'a', status: 'in_progress' },
        { content: 'b', status: 'in_progress' }
      ]
    })

    expect(output).toMatchObject({ ok: true, counts: { in_progress: 1, pending: 1, completed: 0 } })
    if ('ok' in output && output.ok) {
      expect(output.items).toEqual([
        { content: 'a', status: 'in_progress' },
        { content: 'b', status: 'pending' }
      ])
    }
    if ('normalized' in output) expect(output.normalized).toMatch(/one item/i)
    else throw new Error('expected normalized note')
  })

  it('detects unfinished items dropped since the last snapshot', async () => {
    const prior = todoMessage([
      { content: 'keep', status: 'pending' },
      { content: 'gone', status: 'in_progress' },
      { content: 'finished', status: 'completed' }
    ])

    const output = await run(deps([prior]), {
      items: [{ content: 'keep', status: 'in_progress' }]
    })

    if (!('dropped' in output)) throw new Error('expected dropped list')
    expect(output.dropped).toEqual(['gone'])
  })

  it('does not flag completed items that are removed', async () => {
    const prior = todoMessage([{ content: 'finished', status: 'completed' }])

    const output = await run(deps([prior]), { items: [{ content: 'next', status: 'pending' }] })

    expect('dropped' in output).toBe(false)
  })

  it('reads the most recent todo snapshot when several exist', async () => {
    const older = todoMessage([{ content: 'old', status: 'in_progress' }])
    const newer = todoMessage([{ content: 'recent', status: 'in_progress' }])

    const output = await run(deps([older, newer]), { items: [] })

    if (!('dropped' in output)) throw new Error('expected dropped list')
    expect(output.dropped).toEqual(['recent'])
  })

  it('uses persisted normalized output as the previous snapshot', async () => {
    const prior = todoMessageWithOutput(
      [
        { content: 'first', status: 'in_progress' },
        { content: 'second', status: 'in_progress' }
      ],
      [
        { content: 'first', status: 'in_progress' },
        { content: 'second', status: 'pending' }
      ]
    )

    const output = await run(deps([prior]), {
      items: [{ content: 'first', status: 'in_progress' }]
    })

    if (!('dropped' in output)) throw new Error('expected dropped list')
    expect(output.dropped).toEqual(['second'])
  })
})
