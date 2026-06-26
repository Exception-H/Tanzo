import type { ReactNode } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const PILL_TRIGGER = cn(
  'relative inline-flex h-7 flex-none items-center justify-center gap-1.5 rounded-full px-3.5',
  'text-[0.6875rem] font-medium tracking-[0.01em] transition-all duration-150',
  'border-transparent text-foreground/52 hover:text-foreground/72',
  'data-active:bg-background data-active:text-foreground/82 data-active:shadow-sm',
  'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-foreground/52'
)

export function PillTabsBar({
  children,
  className,
  sticky = true
}: {
  children: ReactNode
  className?: string
  sticky?: boolean
}) {
  return (
    <div className={cn('w-full py-3', sticky && 'sticky top-0 z-10')}>
      <div className="mx-auto flex w-full max-w-4xl justify-center">
        <TabsList
          className={cn(
            'relative inline-flex h-9 items-center gap-0.5 rounded-full border border-border/25 bg-muted/25 p-1',
            className
          )}
        >
          {children}
        </TabsList>
      </div>
    </div>
  )
}

export function PillTabsTrigger({
  value,
  children,
  className,
  disabled
}: {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <TabsTrigger value={value} className={cn(PILL_TRIGGER, className)} disabled={disabled}>
      {children}
    </TabsTrigger>
  )
}
