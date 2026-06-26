import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { PROVIDER_CARD_BODY_CLASS, PROVIDER_CARD_CLASS } from './provider-section-styles'

export function ProviderSectionCard({
  icon: Icon,
  title,
  description,
  action,
  children
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}): React.ReactElement {
  return (
    <section className={PROVIDER_CARD_CLASS}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted/35 text-foreground/68 ring-1 ring-inset ring-border/15">
          <Icon className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[0.8125rem] font-medium leading-tight tracking-[0.01em] text-foreground/90">
            {title}
          </h2>
          {description ? (
            <p className="truncate text-[0.625rem] leading-4 tracking-[0.01em] text-foreground/45">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">{action}</div>
        ) : null}
      </div>
      <div className={PROVIDER_CARD_BODY_CLASS}>{children}</div>
    </section>
  )
}
