import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { TanzoDataParts } from '@shared/agent-message'

export interface ContextUsageBadgeProps {
  contextUsed?: number
  compactionTriggerTokens?: number
  recentCompaction?: TanzoDataParts['compaction']
  className?: string
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export function ContextUsageBadge({
  contextUsed,
  compactionTriggerTokens,
  recentCompaction,
  className
}: ContextUsageBadgeProps): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!compactionTriggerTokens || compactionTriggerTokens <= 0) return null

  const hasLiveBudget = typeof contextUsed === 'number' && contextUsed >= 0
  const ratio = hasLiveBudget ? Math.min(contextUsed / compactionTriggerTokens, 1) : 0
  const circumference = 2 * Math.PI * 6
  const offset = circumference * (1 - ratio)
  const hasRecentCompaction = recentCompaction?.stage === 'complete'
  const remainingTokens = hasLiveBudget
    ? Math.max(compactionTriggerTokens - contextUsed, 0)
    : compactionTriggerTokens
  const progressWidth = hasLiveBudget ? `${Math.min(Math.max(ratio * 100, 6), 100)}%` : '28%'

  const hitCompactionTrigger = hasLiveBudget && ratio >= 1

  const ringToneClass = !hasLiveBudget
    ? 'text-muted-foreground/35'
    : hitCompactionTrigger
      ? 'text-red-500'
      : 'text-emerald-500'

  const accentToneClass = !hasLiveBudget
    ? 'bg-muted-foreground/20'
    : hitCompactionTrigger
      ? 'bg-red-500'
      : 'bg-emerald-500'

  const usageMetaToneClass = !hasLiveBudget
    ? 'text-muted-foreground'
    : hitCompactionTrigger
      ? 'text-red-600 dark:text-red-300'
      : 'text-emerald-600 dark:text-emerald-300'

  const recentCompactionBadgeLabel =
    hasRecentCompaction && typeof recentCompaction.reducedTokens === 'number'
      ? recentCompaction.reducedTokens > 0
        ? t('chat.composer.context.saved', { tokens: formatTokens(recentCompaction.reducedTokens) })
        : t('chat.composer.context.compacted')
      : null
  const usageLabel = hasLiveBudget
    ? t('chat.composer.context.usageLabel', { percent: Math.round(ratio * 100) })
    : t('chat.composer.context.usageUnknown')

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              'inline-flex size-7 cursor-default items-center justify-center rounded-sm text-muted-foreground',
              className
            )}
            aria-label={usageLabel}
          />
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          className="rotate-[-90deg]"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted-foreground/15"
          />
          {hasLiveBudget ? (
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={cn('transition-[stroke-dashoffset] duration-300 ease-out', ringToneClass)}
            />
          ) : (
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              className={ringToneClass}
            />
          )}
        </svg>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        sideOffset={8}
        className={cn(
          'w-52 flex-col items-stretch gap-0 overflow-hidden rounded-[var(--radius-md)] border',
          'border-[color-mix(in_oklab,var(--border)_42%,transparent)] bg-popover/96 px-2 py-1.5 text-left text-popover-foreground shadow-md backdrop-blur-md',
          '[&_[data-slot=tooltip-arrow]]:bg-popover [&_[data-slot=tooltip-arrow]]:fill-popover'
        )}
      >
        <div className="w-full space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 tabular-nums">
            <div className={cn('text-[0.8125rem] font-semibold leading-none', usageMetaToneClass)}>
              {hasLiveBudget
                ? t('chat.composer.context.used', { percent: Math.round(ratio * 100) })
                : '—'}
            </div>
            <div className="truncate text-[0.625rem] font-medium leading-none text-muted-foreground">
              {hasLiveBudget ? formatTokens(contextUsed) : '--'} /{' '}
              {formatTokens(compactionTriggerTokens)}
            </div>
          </div>

          <div className="h-1 overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn('h-full transition-[width] duration-300 ease-out', accentToneClass)}
              style={{ width: progressWidth }}
            />
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 text-[0.5625rem] font-medium leading-none text-muted-foreground">
            <span className="min-w-0 truncate">
              {hasLiveBudget
                ? t('chat.composer.context.left', { tokens: formatTokens(remainingTokens) })
                : t('chat.composer.context.waitingForLiveUsage')}
            </span>
            {recentCompactionBadgeLabel && (
              <span className="inline-flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
                <span className="text-foreground/58">{recentCompactionBadgeLabel}</span>
              </span>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
