import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { ToolStatusIndicator } from './status'
import type { ToolUIState } from '../render-context'

export type ToolBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const badgeTone: Record<ToolBadgeTone, string> = {
  neutral: 'bg-foreground/[0.06] text-foreground/60',
  info: 'bg-primary/[0.08] text-primary/80',
  success: 'bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/[0.08] text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/[0.08] text-red-600 dark:text-red-400'
}

const metaTone: Record<ToolBadgeTone, string> = {
  neutral: 'bg-foreground/[0.04] text-foreground/56',
  info: 'bg-primary/[0.07] text-primary/78',
  success: 'bg-emerald-500/[0.08] text-emerald-600/90 dark:text-emerald-400/90',
  warning: 'bg-amber-500/[0.08] text-amber-600/90 dark:text-amber-400/90',
  danger: 'bg-red-500/[0.08] text-red-600/90 dark:text-red-400/90'
}

export interface ToolBadgeProps {
  text: string
  tone?: ToolBadgeTone
  className?: string
}

const toneGlyph: Partial<Record<ToolBadgeTone, string>> = {
  success: '✓',
  warning: '!',
  danger: '×'
}

export function ToolBadge({
  text,
  tone = 'neutral',
  className
}: ToolBadgeProps): React.JSX.Element {
  const glyph = toneGlyph[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[0.5625rem] font-medium tabular-nums',
        badgeTone[tone],
        className
      )}
    >
      {glyph ? (
        <span aria-hidden className="font-semibold">
          {glyph}
        </span>
      ) : null}
      {text}
    </span>
  )
}

export function ToolMetaChip({
  text,
  tone = 'neutral',
  className
}: ToolBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-px font-mono text-[0.5625rem] tabular-nums',
        metaTone[tone],
        className
      )}
    >
      {text}
    </span>
  )
}

export interface ToolHeaderRowProps {
  icon?: React.ElementType
  leading?: ReactNode

  label: string

  title?: string

  subtitle?: string
  badges?: Array<{ text: string; tone?: ToolBadgeTone }>
  meta?: ReactNode
  state: ToolUIState
  className?: string
  labelClassName?: string
  titleClassName?: string
  subtitleClassName?: string
}

export function ToolHeaderRow({
  icon: Icon,
  leading,
  label,
  title,
  subtitle,
  badges,
  meta,
  state,
  className,
  labelClassName,
  titleClassName,
  subtitleClassName
}: ToolHeaderRowProps): React.JSX.Element {
  const hasPrimaryText = Boolean(title || subtitle)

  return (
    <CollapsibleTrigger
      className={cn(
        'group/header flex w-full items-center gap-1.5 overflow-hidden whitespace-nowrap px-2.5 py-1.5 text-left',
        'cursor-pointer select-none transition-colors',
        className
      )}
    >
      {leading ??
        (Icon && (
          <span className="flex size-5 shrink-0 items-center justify-center transition-colors">
            <Icon
              className={cn(
                'size-3.5 shrink-0 transition-colors',
                state === 'input-streaming' || state === 'input-available'
                  ? 'text-primary'
                  : 'text-foreground/68 group-hover/header:text-foreground'
              )}
            />
          </span>
        ))}

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {hasPrimaryText ? (
          <>
            <span
              className={cn(
                'shrink-0 whitespace-nowrap text-[0.75rem] font-medium tracking-[0.01em] text-foreground/52 transition-colors',
                labelClassName
              )}
            >
              {label}
            </span>
            {title && (
              <span
                title={title}
                className={cn(
                  'min-w-0 flex-[1_1_auto] truncate text-[0.8125rem] font-medium text-foreground/90 transition-colors group-hover/header:text-foreground',
                  titleClassName
                )}
              >
                {title}
              </span>
            )}
            {subtitle && (
              <span
                title={subtitle}
                className={cn(
                  'hidden min-w-0 flex-[0.85_1_12rem] truncate font-mono text-[0.625rem] text-foreground/38 transition-colors group-hover/header:text-foreground/56 sm:inline',
                  subtitleClassName
                )}
              >
                <bdi>{subtitle}</bdi>
              </span>
            )}
          </>
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[0.75rem] font-medium tracking-[0.02em] text-foreground/72 transition-colors group-hover/header:text-foreground',
              labelClassName
            )}
          >
            {label}
          </span>
        )}

        {badges && badges.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            {badges.map((badge, index) => (
              <ToolBadge key={`${badge.text}-${index}`} text={badge.text} tone={badge.tone} />
            ))}
          </div>
        )}

        {meta}
      </div>

      <ToolStatusIndicator state={state} className="shrink-0" />
      <ChevronRight className="size-3 shrink-0 text-muted-foreground/80 transition-transform group-hover/header:text-foreground group-data-[panel-open]/header:rotate-90" />
    </CollapsibleTrigger>
  )
}

export interface ToolDiffMetaProps {
  additions?: number
  deletions?: number
}

export function ToolDiffMeta({
  additions,
  deletions
}: ToolDiffMetaProps): React.JSX.Element | null {
  if (!additions && !deletions) return null
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-foreground/[0.04] px-1.5 py-px font-mono text-[0.5625rem]">
      {typeof additions === 'number' && additions > 0 && (
        <span className="text-emerald-600/80 dark:text-emerald-400/80">+{additions}</span>
      )}
      {typeof deletions === 'number' && deletions > 0 && (
        <span className="text-red-600/80 dark:text-red-400/80">-{deletions}</span>
      )}
    </div>
  )
}

export function ToolMetaText({
  children,
  className
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap font-mono text-[0.5625rem] text-muted-foreground/50',
        className
      )}
    >
      {children}
    </span>
  )
}
