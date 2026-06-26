import { AlertTriangle, GitBranch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GitOverview } from '@shared/git'

interface WorkspaceGitPillProps {
  readonly overview: GitOverview | null
  readonly loading?: boolean
  readonly onClick?: () => void
  readonly className?: string
}

function getGitLabelKey(overview: GitOverview | null): string | null {
  if (!overview) return 'gitReview.title'
  if (overview.kind === 'none') return 'gitReview.init.noRepository'
  if (overview.kind === 'error') return 'gitReview.init.unavailable'
  return null
}

export function WorkspaceGitPill({
  overview,
  loading = false,
  onClick,
  className
}: WorkspaceGitPillProps): React.JSX.Element {
  const { t } = useTranslation()
  const dirtyCount = overview
    ? overview.stagedCount + overview.unstagedCount + overview.untrackedCount
    : 0
  const hasConflicts = Boolean(overview?.conflictCount)
  const isRepository = overview?.kind === 'repository'
  const labelKey = getGitLabelKey(overview)
  const label = loading
    ? t('common.actions.refreshing')
    : labelKey
      ? t(labelKey)
      : (overview?.branch ?? t('gitReview.branch.detachedHead'))

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={!overview || loading}
      className={cn(
        'app-no-drag h-7 max-w-[16rem] gap-1.5 rounded-md border-0 bg-transparent px-2 text-[0.6875rem] font-medium shadow-none',
        'text-muted-foreground transition-colors duration-150',
        'hover:bg-transparent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        hasConflicts && 'text-destructive hover:bg-transparent hover:text-destructive',
        className
      )}
    >
      {hasConflicts ? (
        <AlertTriangle className="size-3.5 shrink-0" />
      ) : (
        <GitBranch className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 truncate">{label}</span>
      {dirtyCount > 0 ? (
        <span className="rounded-full bg-foreground/[0.075] px-1.5 py-px text-[0.5625rem] tabular-nums text-foreground/62">
          {dirtyCount}
        </span>
      ) : null}
      {isRepository && (overview.ahead > 0 || overview.behind > 0) ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[0.5625rem] tabular-nums">
          {overview.ahead > 0 ? (
            <span className="text-emerald-500/80">↑{overview.ahead}</span>
          ) : null}
          {overview.behind > 0 ? <span className="text-red-500/80">↓{overview.behind}</span> : null}
        </span>
      ) : null}
    </Button>
  )
}
