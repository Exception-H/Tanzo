import { useTranslation } from 'react-i18next'
import { CircleCheckBig, CircleDashed, ListChecks } from 'lucide-react'
import type { TanzoTools, ToolError } from '@shared/agent-message'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  PANEL_HEIGHT_MD,
  ToolBadge,
  ToolHeaderRow,
  ToolMetaChip,
  ToolMetaLine,
  ToolScrollPanel
} from '../primitives'
import type { ToolRenderContext } from '../render-context'
import type { ToolRenderer } from '../renderer-types'
import { renderToolError } from './render-error'

type TodoOutput = Exclude<TanzoTools['todo']['output'], ToolError>
type TodoItem = TanzoTools['todo']['input']['items'][number]
type TodoStatus = TodoItem['status']
type TodoInput = Partial<TanzoTools['todo']['input']>

function StatusIcon({ status }: { status: TodoStatus }): React.JSX.Element {
  if (status === 'in_progress') {
    return <Spinner className="size-3 shrink-0 text-primary" strokeWidth={2} />
  }
  if (status === 'completed') {
    return <CircleCheckBig className="size-3 shrink-0 text-emerald-500/80" />
  }
  return <CircleDashed className="size-3 shrink-0 text-foreground/30" />
}

function items(context: ToolRenderContext): TodoItem[] {
  const output = context.output as TodoOutput | undefined
  if (output?.ok === true && Array.isArray(output.items)) return output.items
  const input = context.input as TodoInput | undefined
  return Array.isArray(input?.items) ? input.items : []
}

function TodoHeader({ context }: { context: ToolRenderContext }): React.JSX.Element {
  const { t } = useTranslation()
  const list = items(context)
  const done = list.filter((item) => item.status === 'completed').length
  return (
    <ToolHeaderRow
      icon={ListChecks}
      label={t('chat.tool.todo.label')}
      title={list.length > 0 ? `${done}/${list.length}` : '·'}
      state={context.state}
      meta={
        list.length > 0 ? (
          <ToolMetaChip text={t('chat.tool.todo.items', { count: list.length })} />
        ) : null
      }
    />
  )
}

function TodoOutputComp({ context }: { context: ToolRenderContext }): React.JSX.Element | null {
  const { t } = useTranslation()
  const err = renderToolError(context, t('chat.tool.todo.errors.updateFailed'), {
    className: 'm-2.5'
  })
  if (err) return err
  const output = context.output as TodoOutput | undefined
  const list = items(context)
  if (list.length === 0) return null

  return (
    <ToolScrollPanel flush tone="subtle" maxHeight={PANEL_HEIGHT_MD}>
      {output?.normalized ? (
        <ToolMetaLine className="border-b border-border/8 px-3 py-1 text-foreground/65">
          {output.normalized}
        </ToolMetaLine>
      ) : null}
      <ul className="py-1">
        {list.map((item, index) => (
          <li
            key={`${item.content}-${index}`}
            className="flex items-center gap-2 px-3 py-1 transition-colors hover:bg-foreground/[0.035]"
          >
            <StatusIcon status={item.status} />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[0.6875rem] leading-relaxed',
                item.status === 'completed'
                  ? 'text-foreground/45 line-through decoration-foreground/20'
                  : 'text-foreground/80',
                item.status === 'in_progress' && 'font-medium text-foreground'
              )}
              title={item.content}
            >
              {item.content}
            </span>
          </li>
        ))}
      </ul>
      {output?.dropped?.length ? (
        <div className="border-t border-border/8 px-3 py-1.5">
          <div className="mb-1 flex items-center gap-1.5">
            <ToolBadge text={t('chat.tool.todo.dropped')} tone="warning" />
            <span className="text-[0.5625rem] text-muted-foreground">
              {t('chat.tool.todo.unfinishedRemoved')}
            </span>
          </div>
          <ul className="space-y-0.5">
            {output.dropped.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="truncate text-[0.625rem] text-muted-foreground"
                title={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ToolScrollPanel>
  )
}

export const todoRenderer: ToolRenderer = {
  Header: TodoHeader,
  Output: TodoOutputComp,
  renderWhenPending: true,
  fullBleed: true
}
