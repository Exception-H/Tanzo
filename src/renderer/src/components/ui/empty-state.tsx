import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  hint?: string
  searchQuery?: string
  className?: string
  panelClassName?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  hint,
  searchQuery,
  className,
  panelClassName,
  action
}: EmptyStateProps) {
  const { t } = useTranslation()

  const displayTitle = searchQuery ? t('common.empty.noResults') : title
  const displayDescription = searchQuery
    ? t('common.empty.noResultsWithQuery', { query: searchQuery })
    : description
  const displayHint = searchQuery ? t('common.empty.adjustSearch') : hint

  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center px-4 py-12 text-center',
        className
      )}
    >
      <div
        className={cn(
          'w-full max-w-md rounded-[var(--radius-2xl)] border border-dashed border-border/50 bg-background/60 p-6',
          panelClassName
        )}
      >
        <div className="space-y-2">
          {Icon && (
            <div className="flex justify-center">
              <div className="flex size-10 items-center justify-center rounded-full border border-border/50 bg-foreground/[0.06]">
                <Icon className="size-5 text-muted-foreground" />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[0.75rem] font-medium text-foreground">{displayTitle}</p>
            <p className="text-[0.6875rem] text-muted-foreground">{displayDescription}</p>
          </div>
          {displayHint && <p className="text-[0.625rem] text-muted-foreground">{displayHint}</p>}
          {action && <div className="flex justify-center pt-2">{action}</div>}
        </div>
      </div>
    </div>
  )
}
