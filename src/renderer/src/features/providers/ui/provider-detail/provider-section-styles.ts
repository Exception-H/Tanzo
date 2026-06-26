export const PROVIDER_CARD_CLASS = [
  'not-prose overflow-hidden rounded-[var(--radius-xl)] border border-border/15',
  'bg-card/85 shadow-sm backdrop-blur-sm'
].join(' ')

export const PROVIDER_CARD_BODY_CLASS = 'divide-y divide-border/10 border-t border-border/10'

export const PROVIDER_FIELD_ROW_CLASS = [
  'group grid w-full gap-3 px-3 py-2.5 text-left',
  'transition-colors hover:bg-foreground/[0.03]',
  'md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:items-start'
].join(' ')

export const PROVIDER_SUMMARY_PILL_CLASS = [
  'inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-muted/35 px-2.5 py-1',
  'text-[0.6875rem] text-foreground/68 ring-1 ring-inset ring-border/15'
].join(' ')

export const PROVIDER_CONTROL_CLASS = [
  'h-9 w-full rounded-[var(--radius-md)] border-transparent bg-muted/35 text-xs',
  'ring-1 ring-inset ring-border/15 focus-visible:ring-1 focus-visible:ring-primary/40',
  'focus-visible:ring-offset-0'
].join(' ')

export const PROVIDER_TEXTAREA_CLASS = [
  'min-h-28 resize-y rounded-[var(--radius-md)] border-transparent bg-muted/35',
  'font-mono text-[0.6875rem] ring-1 ring-inset ring-border/15',
  'focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0'
].join(' ')

export const PROVIDER_LABEL_CLASS = 'text-[0.8125rem] leading-5 font-medium text-foreground/90'
