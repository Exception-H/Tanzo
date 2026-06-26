import { Target } from 'lucide-react'
import { ToolHeaderRow, type ToolBadgeTone } from '../primitives'
import type { ToolRenderContext } from '../render-context'
import type { ToolRenderer } from '../renderer-types'
import { renderToolError } from './render-error'
import { isToolError } from './shared'

type GoalStatus = 'complete' | 'blocked'
interface GoalInput {
  status?: GoalStatus
}
interface GoalOutput {
  updated: true
  status: GoalStatus
}

const STATUS_BADGE: Record<GoalStatus, { text: string; tone: ToolBadgeTone }> = {
  complete: { text: 'complete', tone: 'success' },
  blocked: { text: 'blocked', tone: 'danger' }
}

function goalStatus(context: ToolRenderContext): GoalStatus | null {
  const output = context.output
  if (output !== undefined && !isToolError(output)) return (output as GoalOutput).status
  const input = context.input as GoalInput | undefined
  return input?.status ?? null
}

function GoalHeader({ context }: { context: ToolRenderContext }): React.JSX.Element {
  const status = goalStatus(context)
  const badge = status ? STATUS_BADGE[status] : null
  return (
    <ToolHeaderRow
      icon={Target}
      label="Goal"
      state={context.state}
      badges={badge ? [badge] : undefined}
    />
  )
}

function GoalOutputComp({ context }: { context: ToolRenderContext }): React.JSX.Element | null {
  return renderToolError(context, 'Goal update failed.', { className: 'm-2.5' })
}

export const goalRenderer: ToolRenderer = {
  Header: GoalHeader,
  Output: GoalOutputComp,
  renderWhenPending: true
}
