import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RadioIndicator, SETTINGS_ROW_CLASS } from '../shared/settings-primitives'

interface ThemeOptionRowProps {
  label: string
  description?: string
  selected?: boolean
  onClick: () => void
  preview: ReactNode
  previewClassName?: string
}

export function ThemeOptionRow({
  label,
  description,
  selected = false,
  onClick,
  preview,
  previewClassName
}: ThemeOptionRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        SETTINGS_ROW_CLASS,
        'h-auto justify-start rounded-none hover:text-foreground',
        selected && 'bg-primary/[0.06]'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-14 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-muted/35 p-1 ring-1 ring-inset ring-border/15',
          previewClassName
        )}
      >
        {preview}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.6875rem] font-medium leading-5 tracking-[0.01em] text-foreground/82">
          {label}
        </div>
        {description ? (
          <div className="truncate text-[0.625rem] leading-3.5 tracking-[0.01em] text-foreground/52">
            {description}
          </div>
        ) : null}
      </div>
      <RadioIndicator selected={selected} />
    </Button>
  )
}
