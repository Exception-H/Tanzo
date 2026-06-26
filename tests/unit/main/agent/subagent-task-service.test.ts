import { describe, expect, it, vi } from 'vitest'
import type { SubagentTask } from '@shared/subagent-task'
import { createTaskService } from '@main/agent/subagent/task-service'

function task(overrides: Partial<SubagentTask> = {}): SubagentTask {
  return {
    id: 'explore-1',
    chatId: 'child-chat',
    parentChatId: 'root-chat',
    rootChatId: 'root-chat',
    agentType: 'explore',
    objective: 'inspect',
    status: 'running',
    dependsOn: [],
    allowedTools: ['fileRead'],
    phases: [],
    createdAt: 1,
    startedAt: 1,
    ...overrides
  }
}

describe('agent/subagent/task-service', () => {
  it('cancels a task without recursively cancelling itself forever', () => {
    const tasks = new Map<string, SubagentTask>()
    tasks.set('explore-1', task())
    const update = vi.fn((next: SubagentTask) => tasks.set(next.id, next))
    const callbacks = {
      abortRun: vi.fn(),
      clearTransientChatState: vi.fn(),
      currentRunEpoch: vi.fn(() => 0),
      hasAdvancedSince: vi.fn(() => false),
      isInflight: vi.fn(() => false),
      startChatRun: vi.fn()
    }
    const service = createTaskService(
      {
        store: {
          rootOf: vi.fn(() => 'root-chat'),
          transaction: vi.fn((fn: () => unknown) => fn()),
          tasks: {
            get: vi.fn((_rootChatId: string, taskId: string) => tasks.get(taskId)),
            getByChat: vi.fn(),
            listByRoot: vi.fn(() => [...tasks.values()]),
            update,
            insert: vi.fn(),
            nextSeq: vi.fn(() => 1),
            countByAgent: vi.fn(() => 0)
          }
        },
        send: vi.fn(),
        sendTo: vi.fn(),
        identity: {},
        providerService: {},
        buildTools: vi.fn(),
        policy: {}
      } as never,
      { compaction: {} as never, policy: { remember: vi.fn() } as never },
      callbacks
    )

    expect(() => service.cancel('root-chat', 'explore-1')).not.toThrow()
    expect(tasks.get('explore-1')?.status).toBe('cancelled')
    expect(callbacks.abortRun).toHaveBeenCalledWith('child-chat')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('fails orphaned unsettled tasks on reconcile (no live driver)', () => {
    const tasks = new Map<string, SubagentTask>()
    tasks.set('explore-1', task({ status: 'running' }))
    tasks.set('explore-2', task({ id: 'explore-2', chatId: 'child-2', status: 'blocked' }))
    tasks.set('explore-3', task({ id: 'explore-3', chatId: 'child-3', status: 'done' }))
    const update = vi.fn((next: SubagentTask) => tasks.set(next.id, next))
    const callbacks = {
      abortRun: vi.fn(),
      clearTransientChatState: vi.fn(),
      currentRunEpoch: vi.fn(() => 0),
      hasAdvancedSince: vi.fn(() => false),
      isInflight: vi.fn(() => false),
      startChatRun: vi.fn()
    }
    const unsettled = (): SubagentTask[] =>
      [...tasks.values()].filter((t) => ['pending', 'running', 'blocked'].includes(t.status))
    const service = createTaskService(
      {
        store: {
          rootOf: vi.fn(() => 'root-chat'),
          transaction: vi.fn((fn: () => unknown) => fn()),
          tasks: {
            get: vi.fn((_rootChatId: string, taskId: string) => tasks.get(taskId)),
            getByChat: vi.fn(),
            listByRoot: vi.fn(() => [...tasks.values()]),
            listUnsettled: vi.fn(unsettled),
            update,
            insert: vi.fn(),
            nextSeq: vi.fn(() => 1),
            countByAgent: vi.fn(() => 0)
          }
        },
        send: vi.fn(),
        sendTo: vi.fn(),
        identity: {},
        providerService: {},
        buildTools: vi.fn(),
        policy: {}
      } as never,
      { compaction: {} as never, policy: { remember: vi.fn() } as never },
      callbacks
    )

    const count = service.reconcileOrphans()
    expect(count).toBe(2)
    expect(tasks.get('explore-1')?.status).toBe('failed')
    expect(tasks.get('explore-2')?.status).toBe('failed')
    expect(tasks.get('explore-3')?.status).toBe('done')
    expect(tasks.get('explore-1')?.result?.errorMessage).toContain('restarted')
  })
})
