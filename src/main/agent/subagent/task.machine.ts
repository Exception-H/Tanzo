/**
 * Subagent task state machine (pure core). See docs/state-machine-unification.md §4.3.
 *
 * State graph (status field of SubagentTask):
 *
 *   pending ──start──▶ running ──surface-approvals──▶ blocked(approval)
 *      │ └─fail──▶ failed              │  ▲                  │
 *      │                               │  └─clear-approvals──┘
 *      │                          ┌────┼────┬──────────┐
 *      │                      complete  fail     cancel   (terminal)
 *      └─(spawn with unmet deps)─▶ pending(block:dependency)
 *
 * The pure transition produces the next task object plus effect descriptions
 * (persist, notify-settled). Imperative pre-steps that some callers run before a
 * transition (aborting controllers, saving messages, starting the driver) stay
 * in the interpreter shell (task-service.ts); they are not modeled here.
 *
 * `now` is supplied via event payloads to keep the transition pure.
 */
import type { SubagentTask, SubagentTaskApproval, SubagentTaskResult } from '@shared/subagent-task'
import { next, stay, type Transition } from '../runtime/machine/types'

export const TASK_TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled'] as const)

export function isTaskTerminal(status: SubagentTask['status']): boolean {
  return TASK_TERMINAL_STATUSES.has(status as 'done' | 'failed' | 'cancelled')
}

export type TaskEvent =
  | { kind: 'start'; now: number }
  | { kind: 'fail'; message: string; now: number }
  | { kind: 'complete'; summary: string; now: number }
  | { kind: 'surface-approvals'; approvals: SubagentTaskApproval[] }
  | { kind: 'clear-approval-block' }
  | { kind: 'cancel'; now: number }
  | { kind: 'resume'; now: number }
  | { kind: 'redefine'; objective: string; now: number }
  | { kind: 'retry'; now: number }
  | { kind: 'set-phase'; phase: string; now: number }
  | { kind: 'set-result'; result: SubagentTaskResult }

export type TaskEffect = { kind: 'persist' } | { kind: 'notify-settled' }

const PERSIST: readonly TaskEffect[] = [{ kind: 'persist' }]
const PERSIST_AND_SETTLE: readonly TaskEffect[] = [{ kind: 'persist' }, { kind: 'notify-settled' }]

function withoutBlock(task: SubagentTask): SubagentTask {
  const rest = { ...task }
  delete rest.block
  return rest
}

export function taskTransition(
  task: SubagentTask,
  event: TaskEvent
): Transition<SubagentTask, TaskEffect> {
  switch (event.kind) {
    case 'start':
      return next({ ...withoutBlock(task), status: 'running', startedAt: event.now }, PERSIST)

    case 'fail': {
      if (isTaskTerminal(task.status)) return stay(task)
      return next(
        {
          ...withoutBlock(task),
          status: 'failed',
          completedAt: event.now,
          result: { summary: '', failed: true, errorMessage: event.message }
        },
        PERSIST_AND_SETTLE
      )
    }

    case 'complete': {
      if (isTaskTerminal(task.status)) return stay(task)
      const done: SubagentTask = {
        ...withoutBlock(task),
        status: 'done',
        completedAt: event.now,
        result: { summary: event.summary }
      }
      delete done.phase
      return next(done, PERSIST_AND_SETTLE)
    }

    case 'surface-approvals':
      return next(
        { ...task, status: 'blocked', block: { kind: 'approval', approvals: event.approvals } },
        PERSIST
      )

    case 'clear-approval-block':
      if (task.block?.kind !== 'approval') return stay(task)
      return next({ ...withoutBlock(task), status: 'running' }, PERSIST)

    case 'cancel': {
      if (isTaskTerminal(task.status)) return stay(task)
      return next(
        { ...withoutBlock(task), status: 'cancelled', completedAt: event.now },
        PERSIST_AND_SETTLE
      )
    }

    case 'resume':
      return next(
        {
          ...withoutBlock(task),
          status: 'running',
          startedAt: task.startedAt ?? event.now
        },
        PERSIST
      )

    case 'redefine': {
      const restarted: SubagentTask = {
        ...withoutBlock(task),
        objective: event.objective,
        status: 'running',
        startedAt: event.now,
        phases: []
      }
      delete restarted.phase
      delete restarted.result
      return next(restarted, PERSIST)
    }

    case 'retry': {
      if (task.status !== 'failed' && task.status !== 'cancelled') return stay(task)
      const restarted: SubagentTask = {
        ...withoutBlock(task),
        status: 'running',
        startedAt: event.now,
        phases: []
      }
      delete restarted.phase
      delete restarted.result
      return next(restarted, PERSIST)
    }

    case 'set-phase':
      if (isTaskTerminal(task.status)) return stay(task)
      return next(
        {
          ...task,
          phase: event.phase,
          phases: [...task.phases, { name: event.phase, at: event.now }]
        },
        PERSIST
      )

    case 'set-result':
      return next({ ...task, result: event.result }, PERSIST)

    default:
      return stay(task)
  }
}
