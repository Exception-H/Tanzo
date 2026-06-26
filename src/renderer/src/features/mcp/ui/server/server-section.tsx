import type { ReactNode } from 'react'

export function ServerSectionHeader({
  icon,
  title,
  action
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted/35 text-foreground/68 ring-1 ring-inset ring-border/15">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium leading-tight tracking-[0.01em] text-foreground/90">
        {title}
      </span>
      {action ?? null}
    </div>
  )
}
