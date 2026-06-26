import type { SubagentTask, SubagentTaskApprovalView } from '@shared/subagent-task'
import type { TanzoDataParts } from '@shared/agent-message'

export interface DataPartHandlers {
  setTransientStatus: (label: string | null) => void
  setContextStatus: (context: TanzoDataParts['context']) => void
  onCompaction: (data: TanzoDataParts['compaction'], id?: string) => void
  setTasks: (tasks: SubagentTask[]) => void
  setTaskApprovals: (approvals: SubagentTaskApprovalView[]) => void
  setQueued: (items: TanzoDataParts['queued']['items']) => void
  setGoal: (goal: TanzoDataParts['goal']['goal']) => void
  handleTelemetry: (event: TanzoDataParts['telemetry']) => void
}

export function routeDataPart(
  dataPart: { type: string; id?: string; data?: unknown },
  handlers: DataPartHandlers
): void {
  switch (dataPart.type) {
    case 'data-status': {
      const label = (dataPart.data as { label?: unknown } | undefined)?.label
      handlers.setTransientStatus(typeof label === 'string' && label ? label : null)
      break
    }
    case 'data-context':
      handlers.setContextStatus(dataPart.data as TanzoDataParts['context'])
      break
    case 'data-compaction':
      handlers.onCompaction(dataPart.data as TanzoDataParts['compaction'], dataPart.id)
      break
    case 'data-task': {
      const tasks = (dataPart.data as TanzoDataParts['task'] | undefined)?.tasks
      if (Array.isArray(tasks)) handlers.setTasks(tasks)
      break
    }
    case 'data-taskApproval': {
      const approvals = (dataPart.data as TanzoDataParts['taskApproval'] | undefined)?.approvals
      if (Array.isArray(approvals)) handlers.setTaskApprovals(approvals)
      break
    }
    case 'data-steering': {
      const text = (dataPart.data as { text?: unknown } | undefined)?.text
      if (typeof text === 'string' && text) handlers.setTransientStatus(text)
      break
    }
    case 'data-queued': {
      const items = (dataPart.data as TanzoDataParts['queued'] | undefined)?.items
      if (Array.isArray(items)) handlers.setQueued(items)
      break
    }
    case 'data-goal':
      handlers.setGoal((dataPart.data as TanzoDataParts['goal'] | undefined)?.goal ?? null)
      break
    case 'data-telemetry': {
      const event = dataPart.data as TanzoDataParts['telemetry'] | undefined
      if (event && event.scope === 'chat') handlers.handleTelemetry(event)
      break
    }
  }
}
