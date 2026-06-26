import { CircleCheckBig, CircleDashed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  TODO_PANEL_CONTENT_MAX_HEIGHT_REM,
  type TodoPanelStatus,
  type TodoPanelTask
} from './todo-panel-utils'

export interface TodoPanelContentProps {
  todos: TodoPanelTask[]
  className?: string
  maxHeight?: number | string
}

function StatusIcon({ status }: { status: TodoPanelStatus }): React.JSX.Element {
  if (status === 'in_progress') {
    return <Spinner className="size-3 shrink-0 text-primary" strokeWidth={2} />
  }
  if (status === 'completed') {
    return <CircleCheckBig className="size-3 shrink-0 text-emerald-500/80" />
  }
  return <CircleDashed className="size-3 shrink-0 text-foreground/30" />
}

export function TodoPanelContent({
  todos,
  className,
  maxHeight
}: TodoPanelContentProps): React.JSX.Element {
  const { t } = useTranslation()

  if (todos.length === 0) {
    return (
      <div className={cn('px-3 py-2 text-[0.6875rem] text-muted-foreground/55', className)}>
        {t('chat.composer.todoPanel.empty')}
      </div>
    )
  }

  return (
    <div
      className={cn('scrollbar-none overflow-y-auto overscroll-contain py-1', className)}
      style={{ maxHeight: maxHeight ?? `${TODO_PANEL_CONTENT_MAX_HEIGHT_REM}rem` }}
    >
      {todos.map((todo, index) => (
        <div
          key={`${todo.content}-${index}`}
          className="flex items-center gap-2 px-3 py-1 transition-colors hover:bg-foreground/[0.035]"
        >
          <StatusIcon status={todo.status} />
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[0.6875rem] leading-relaxed',
              todo.status === 'completed'
                ? 'text-foreground/45 line-through decoration-foreground/20'
                : 'text-foreground/80',
              todo.status === 'in_progress' && 'font-medium text-foreground'
            )}
            title={todo.content}
          >
            {todo.content}
          </span>
        </div>
      ))}
    </div>
  )
}
