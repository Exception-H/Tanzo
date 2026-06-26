import { createContext, useContext, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader,
  SidebarToggleButton,
  type PageHeaderStat
} from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { SearchInput, type ActiveFilters, type FilterGroup } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'

export type { ActiveFilters, FilterGroup, PageHeaderStat }

const EmbeddedScaffoldContext = createContext(false)

export function EmbeddedScaffoldProvider({ children }: { children: ReactNode }) {
  return (
    <EmbeddedScaffoldContext.Provider value={true}>{children}</EmbeddedScaffoldContext.Provider>
  )
}

export interface PageScaffoldProps {
  title: string
  titleMeta?: ReactNode
  stats?: PageHeaderStat[]
  actions?: ReactNode
  leadingActions?: ReactNode
  onBack?: () => void
  children: ReactNode
}

export interface ListPageScaffoldProps extends PageScaffoldProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterGroup[]
  activeFilters?: ActiveFilters
  onFilterChange?: (key: string, value: string | undefined) => void
  contentClassName?: string
  scrollClassName?: string
}

export function ListPageScaffold({
  title,
  titleMeta,
  stats,
  actions,
  leadingActions,
  onBack,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilters,
  onFilterChange,
  contentClassName,
  scrollClassName,
  children
}: ListPageScaffoldProps) {
  const { t } = useTranslation()
  const embedded = useContext(EmbeddedScaffoldContext)
  const showSearch = searchValue !== undefined && onSearchChange !== undefined
  const resolvedPlaceholder = searchPlaceholder ?? t('common.search.placeholder')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {embedded ? (
        <EmbeddedScaffoldHeader
          title={title}
          titleMeta={titleMeta}
          stats={stats}
          actions={actions}
          leadingActions={leadingActions}
          onBack={onBack}
        />
      ) : (
        <PageHeader
          title={title}
          titleMeta={titleMeta}
          stats={stats}
          actions={actions}
          leadingActions={leadingActions}
          onBack={onBack}
        />
      )}

      <div className={cn('flex-1 overflow-y-auto scrollbar-elegant', scrollClassName)}>
        <div className="flex min-h-full flex-col">
          {showSearch ? (
            <div className="sticky top-0 z-10 shrink-0">
              <div className="px-5 py-4">
                <SearchInput
                  value={searchValue}
                  onChange={onSearchChange}
                  placeholder={resolvedPlaceholder}
                  filters={filters}
                  activeFilters={activeFilters}
                  onFilterChange={onFilterChange}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-1 flex-col">
            <div className={cn('flex w-full flex-1 flex-col px-5 pb-6', contentClassName)}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmbeddedScaffoldHeader({
  title,
  titleMeta,
  stats,
  actions,
  leadingActions,
  onBack
}: Omit<PageScaffoldProps, 'children'>) {
  const { t } = useTranslation()
  const totalCount = stats?.[0]?.value ?? 0

  return (
    <div className="flex shrink-0 items-center gap-2 px-5 pt-1 pb-3">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <SidebarToggleButton className="-ml-1" />
        {leadingActions ? <div className="flex items-center gap-1">{leadingActions}</div> : null}
        {onBack ? (
          <Button
            onClick={onBack}
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7 w-auto gap-1 px-2', '-ml-1')}
            aria-label={t('common.actions.goBack')}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="text-[0.6875rem] font-medium">{t('common.actions.back')}</span>
          </Button>
        ) : null}
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate text-[0.875rem] font-semibold leading-tight tracking-tight">
            {title}
          </h2>
          {titleMeta ? <div className="min-w-0 max-w-[40vw] shrink">{titleMeta}</div> : null}
          {totalCount > 0 && stats && stats.length > 0 ? (
            <div className="flex items-center gap-2 text-[0.625rem] text-muted-foreground/80">
              {stats.map((stat, index) => (
                <span key={stat.label} className="flex items-center gap-1">
                  {index > 0 ? (
                    <span className="text-muted-foreground/30" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  <span className="font-medium tabular-nums text-foreground/80">{stat.value}</span>
                  <span>{stat.label}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-1 [&_[data-slot=button]]:h-7 [&_[data-slot=button]]:rounded-md [&_[data-slot=button]]:text-[0.6875rem] [&_[data-slot=button]]:font-medium">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export interface EntityDetailScaffoldProps extends PageScaffoldProps {
  contentClassName?: string
  scrollClassName?: string
}

export function EntityDetailScaffold({
  title,
  titleMeta,
  stats,
  actions,
  leadingActions,
  onBack,
  contentClassName,
  scrollClassName,
  children
}: EntityDetailScaffoldProps) {
  return (
    <ListPageScaffold
      title={title}
      titleMeta={titleMeta}
      stats={stats}
      actions={actions}
      leadingActions={leadingActions}
      onBack={onBack}
      contentClassName={contentClassName}
      scrollClassName={scrollClassName}
    >
      {children}
    </ListPageScaffold>
  )
}
