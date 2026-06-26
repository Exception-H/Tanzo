import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SETTINGS_ROW_CLASS = cn(
  'group flex min-h-11 w-full items-center gap-3 px-3 py-1.5 text-left',
  'transition-colors duration-150 hover:bg-foreground/[0.03]'
)

export function SectionCard({
  icon,
  title,
  description,
  action,
  children
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="not-prose overflow-hidden rounded-[var(--radius-xl)] border border-border/15 bg-card/85 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted/35 text-foreground/68 ring-1 ring-inset ring-border/15">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[0.8125rem] font-medium leading-tight tracking-[0.01em] text-foreground/90">
            {title}
          </h2>
          <p className="truncate text-[0.625rem] leading-4 tracking-[0.01em] text-foreground/45">
            {description}
          </p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
      </div>
      <div className="divide-y divide-border/10 border-t border-border/10">{children}</div>
    </section>
  )
}

export function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <div
      className={cn(
        'flex size-3.5 shrink-0 items-center justify-center rounded-full border border-border/25 transition-colors',
        selected && 'border-primary/50 bg-primary text-primary-foreground'
      )}
    >
      {selected ? <Check className="size-2" strokeWidth={3} /> : null}
    </div>
  )
}
