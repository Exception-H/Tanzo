import { cn } from '@/lib/utils'

export const SERVER_CARD_CLASS = cn(
  'not-prose overflow-hidden rounded-[var(--radius-xl)] border border-border/15',
  'bg-card/85 shadow-sm backdrop-blur-sm'
)

export const SERVER_CARD_BODY_CLASS = 'divide-y divide-border/10 border-t border-border/10'

export const SERVER_ROW_CLASS = cn(
  'group flex min-h-11 items-center gap-2 px-3 py-2',
  'transition-colors duration-150 hover:bg-foreground/[0.03]'
)
