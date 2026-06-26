import { useState } from 'react'
import { Target, Pencil, Pause, Play, X, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TanzoDataParts } from '@shared/agent-message'
import { cn } from '@/lib/utils'
import { iconButtonClass } from './surface-style'

export interface GoalPanelRowProps {
  goal: NonNullable<TanzoDataParts['goal']['goal']>
  className?: string
  onEdit: (objective: string) => void
  onPause: () => void
  onResume: () => void
  onClear: () => void
}

const STATUS_TONE: Record<string, string> = {
  active: 'text-emerald-500',
  paused: 'text-amber-500',
  blocked: 'text-rose-500',
  budget_limited: 'text-orange-500',
  usage_limited: 'text-orange-500',
  complete: 'text-blue-500'
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

function formatUsage(goal: GoalPanelRowProps['goal']): string {
  const parts: string[] = []
  if (goal.tokenBudget != null)
    parts.push(`${formatTokens(goal.tokensUsed)}/${formatTokens(goal.tokenBudget)} tok`)
  else if (goal.tokensUsed > 0) parts.push(`${formatTokens(goal.tokensUsed)} tok`)
  if (goal.timeBudgetSeconds != null)
    parts.push(`${goal.timeUsedSeconds}/${goal.timeBudgetSeconds}s`)
  else if (goal.timeUsedSeconds > 0) parts.push(`${goal.timeUsedSeconds}s`)
  return parts.join(' · ')
}

export function GoalPanelRow({
  goal,
  className,
  onEdit,
  onPause,
  onResume,
  onClear
}: GoalPanelRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(goal.objective)
  const usage = formatUsage(goal)
  const tone = STATUS_TONE[goal.status] ?? 'text-muted-foreground'
  const canPause = goal.status === 'active'
  const canResume = goal.status === 'paused' || goal.status === 'blocked'

  const startEdit = (): void => {
    setDraft(goal.objective)
    setEditing(true)
  }
  const commit = (): void => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== goal.objective) onEdit(next)
  }
  const cancel = (): void => {
    setEditing(false)
    setDraft(goal.objective)
  }

  return (
    <div
      className={cn(
        'group flex h-7 items-center gap-1.5 px-3 text-secondary-foreground/70',
        className
      )}
    >
      <Target className={cn('size-3.5 shrink-0', tone)} strokeWidth={1.9} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            }
          }}
          onBlur={commit}
          placeholder={t('chat.goal.editPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-secondary-foreground outline-none placeholder:text-secondary-foreground/40"
        />
      ) : (
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="min-w-0 truncate text-xs font-medium">{goal.objective}</span>
          <span className="shrink-0 text-[0.625rem] text-muted-foreground/60">
            {t(`chat.goal.status.${goal.status}`)}
            {usage ? (
              <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {` · ${usage}`}
              </span>
            ) : null}
          </span>
        </div>
      )}
      {editing ? (
        <>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={commit}
            aria-label={t('chat.goal.save')}
            className={iconButtonClass}
          >
            <Check className="size-3" strokeWidth={2} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={cancel}
            aria-label={t('chat.goal.cancelEdit')}
            className={iconButtonClass}
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={startEdit}
            aria-label={t('chat.goal.edit')}
            className={iconButtonClass}
          >
            <Pencil className="size-3" strokeWidth={2} />
          </button>
          {canPause ? (
            <button
              type="button"
              onClick={onPause}
              aria-label={t('chat.goal.pause')}
              className={iconButtonClass}
            >
              <Pause className="size-3" strokeWidth={2} />
            </button>
          ) : null}
          {canResume ? (
            <button
              type="button"
              onClick={onResume}
              aria-label={t('chat.goal.resume')}
              className={iconButtonClass}
            >
              <Play className="size-3" strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            aria-label={t('chat.goal.clear')}
            className={iconButtonClass}
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
