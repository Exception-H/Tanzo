import { memo } from 'react'
import { Ban, CircleAlert, CircleCheck, CircleCheckBig, CircleDashed, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShimmerText } from './shimmer'
import type { ToolUIState } from '../render-context'

export interface ToolStatusIndicatorProps {
  state: ToolUIState
  className?: string

  showLabel?: boolean

  label?: string
}

interface StateMeta {
  Icon: typeof CircleDashed
  tone: string
  shimmer: boolean
  spin?: boolean
}

const STATE_META: Record<ToolUIState, StateMeta> = {
  'input-streaming': { Icon: CircleDashed, tone: 'text-primary', shimmer: true, spin: true },
  'input-available': { Icon: CircleDashed, tone: 'text-primary/70', shimmer: true },
  'approval-requested': { Icon: Pause, tone: 'text-amber-500', shimmer: false },
  'approval-responded': { Icon: CircleCheck, tone: 'text-blue-500', shimmer: false },
  'output-available': { Icon: CircleCheckBig, tone: 'text-emerald-500/85', shimmer: false },
  'output-error': { Icon: CircleAlert, tone: 'text-red-500', shimmer: false },
  'output-denied': { Icon: Ban, tone: 'text-muted-foreground/70', shimmer: false }
}

export const ToolStatusIndicator = memo(function ToolStatusIndicator({
  state,
  className,
  showLabel = false,
  label
}: ToolStatusIndicatorProps): React.JSX.Element {
  const meta = STATE_META[state]
  const Icon = meta.Icon
  const text = label ?? defaultLabel(state)
  const isLive = meta.shimmer

  return (
    <span
      className={cn('inline-flex items-center gap-1', meta.tone, className)}
      role={isLive ? 'status' : 'img'}
      aria-label={text}
      aria-live={isLive ? 'polite' : undefined}
    >
      {meta.shimmer ? (
        <ShimmerText
          text={showLabel ? text : '…'}
          className={cn(
            'leading-none',
            showLabel ? 'text-[0.5625rem]' : 'text-[0.5625rem] tracking-[0.05em]'
          )}
        />
      ) : (
        <Icon aria-hidden className={cn('size-3 shrink-0', meta.spin && 'animate-spin')} />
      )}
      {showLabel && !meta.shimmer && (
        <span aria-hidden className="text-[0.5625rem]">
          {text}
        </span>
      )}
    </span>
  )
})

function defaultLabel(state: ToolUIState): string {
  switch (state) {
    case 'input-streaming':
      return 'streaming'
    case 'input-available':
      return 'pending'
    case 'approval-requested':
      return 'awaiting approval'
    case 'approval-responded':
      return 'approved'
    case 'output-available':
      return 'done'
    case 'output-error':
      return 'error'
    case 'output-denied':
      return 'denied'
  }
}
