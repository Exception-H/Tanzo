import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, SlidersHorizontal, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
}

export type ActiveFilters = Record<string, string | undefined>

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  size?: 'default' | 'compact'
  tone?: 'default' | 'subtle'
  className?: string
  filters?: FilterGroup[]
  activeFilters?: ActiveFilters
  onFilterChange?: (key: string, value: string | undefined) => void
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  size = 'default',
  tone = 'default',
  className,
  filters,
  activeFilters = {},
  onFilterChange
}: SearchInputProps) {
  const { t } = useTranslation()
  const hasFilters = filters && filters.length > 0
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0
  const resolvedPlaceholder = placeholder ?? t('common.search.placeholder')
  const inputAriaLabel = ariaLabel ?? resolvedPlaceholder
  const isCompact = size === 'compact'
  const isSubtle = tone === 'subtle'

  const clearAllFilters = () => {
    if (onFilterChange) {
      Object.keys(activeFilters).forEach((key) => onFilterChange(key, undefined))
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="shrink-0 relative group/search">
        <div
          className={cn(
            'flex items-center overflow-hidden transition-all duration-200',
            isSubtle
              ? 'bg-muted/50 border border-border/50'
              : 'bg-secondary border border-border/40',
            isCompact
              ? 'h-8 gap-1.5 px-2.5 rounded-[var(--radius-lg)]'
              : 'h-9 gap-2 px-3 rounded-[var(--radius-xl)]'
          )}
        >
          <Search className="size-3.5 shrink-0 text-foreground/40 group-focus-within/search:text-foreground/60" />
          <Input
            type="text"
            placeholder={resolvedPlaceholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={inputAriaLabel}
            className={cn(
              '!h-auto !min-w-0 flex-1 !border-0 !bg-transparent !px-0 !py-0 !shadow-none !ring-0',
              'focus-visible:!border-0 focus-visible:!ring-0 focus-visible:!ring-offset-0',
              'text-foreground/82 placeholder:text-foreground/35',
              isCompact ? 'text-[0.8125rem]' : 'text-[0.75rem] tracking-[0.01em]'
            )}
          />
          <div className="flex items-center gap-0.5 shrink-0">
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onChange('')}
                aria-label={t('common.actions.close')}
                className={cn(
                  'rounded-[var(--radius-md)] border-0 bg-transparent shadow-none',
                  'text-foreground/35 hover:text-foreground/60 hover:bg-foreground/[0.06] transition-colors',
                  isCompact ? 'size-5' : 'size-6'
                )}
              >
                <X className="size-3" />
              </Button>
            )}
            {hasFilters && (
              <FilterDropdown
                filters={filters}
                activeFilters={activeFilters}
                activeFilterCount={activeFilterCount}
                hasActiveFilters={hasActiveFilters}
                isCompact={isCompact}
                onFilterChange={onFilterChange}
                clearAllFilters={clearAllFilters}
                t={t}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface FilterDropdownProps {
  filters: FilterGroup[]
  activeFilters: ActiveFilters
  activeFilterCount: number
  hasActiveFilters: boolean
  isCompact: boolean
  onFilterChange?: (key: string, value: string | undefined) => void
  clearAllFilters: () => void
  t: (key: string) => string
}

function FilterDropdown({
  filters,
  activeFilters,
  activeFilterCount,
  hasActiveFilters,
  isCompact,
  onFilterChange,
  clearAllFilters,
  t
}: FilterDropdownProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              'relative rounded-[var(--radius-md)] border-0 shadow-none transition-colors',
              isCompact ? 'size-5' : 'size-6',
              hasActiveFilters
                ? 'text-primary bg-primary/10 hover:bg-primary/15'
                : 'text-foreground/35 hover:text-foreground/60 hover:bg-foreground/[0.06]'
            )}
          />
        }
      >
        <SlidersHorizontal className="size-3" />
        {hasActiveFilters && (
          <span className="absolute -top-0.5 -right-0.5 size-3 flex items-center justify-center rounded-full bg-primary text-[0.5rem] font-semibold text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="min-w-[180px] w-auto rounded-[var(--radius-lg)] border border-border/40 bg-secondary p-0 shadow-lg"
      >
        <Command className="bg-transparent">
          <CommandList>
            {filters.map((group, i) => (
              <CommandGroup
                key={group.key}
                heading={group.label}
                className={cn(
                  'p-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[0.5625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-foreground/35',
                  i > 0 && 'border-t border-border/30'
                )}
              >
                {group.options.map((option) => {
                  const isActive = activeFilters[group.key] === option.value
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() =>
                        onFilterChange?.(group.key, isActive ? undefined : option.value)
                      }
                      className={cn(
                        'gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-[0.6875rem] tracking-[0.01em] cursor-pointer',
                        'data-[selected=true]:bg-foreground/[0.06]',
                        isActive ? 'text-foreground/82' : 'text-foreground/60'
                      )}
                    >
                      <span className="flex-1">{option.label}</span>
                      {isActive && <Check className="size-3 text-primary shrink-0" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
          {hasActiveFilters && (
            <div className="border-t border-border/30 px-1.5 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearAllFilters}
                className="w-full h-6 rounded-[var(--radius-md)] text-[0.625rem] font-medium tracking-[0.01em] text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.04] shadow-none transition-colors"
              >
                <X className="size-2.5" />
                {t('common.search.clearFilters')}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
