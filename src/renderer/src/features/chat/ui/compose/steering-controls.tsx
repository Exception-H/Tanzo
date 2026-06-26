import { ArrowUp, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface SteeringControlsProps {
  canSubmit: boolean
  onQueue?: () => void
  onSteer?: () => void
}

export function SteeringControls({
  canSubmit,
  onQueue,
  onSteer
}: SteeringControlsProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={(triggerProps) => (
            <Button
              {...triggerProps}
              type="button"
              onClick={onSteer}
              disabled={!canSubmit || !onSteer}
              aria-label={t('chat.composer.steer')}
              variant="ghost"
              size="icon-xs"
              className={cn(
                'size-[22px] rounded-[var(--radius-4xl)] p-0 transition-all duration-150',
                'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                canSubmit && onSteer
                  ? 'text-foreground hover:bg-foreground/10 active:scale-[0.96]'
                  : 'pointer-events-none text-muted-foreground/50'
              )}
            >
              <Zap className="size-3.25" strokeWidth={1.95} />
            </Button>
          )}
        />
        <TooltipContent side="top">{t('chat.composer.steerShortcut')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={(triggerProps) => (
            <Button
              {...triggerProps}
              type="button"
              onClick={onQueue}
              disabled={!canSubmit || !onQueue}
              aria-label={t('chat.composer.queue')}
              size="icon-xs"
              className={cn(
                'size-[22px] rounded-[var(--radius-4xl)] p-0',
                'transition-all duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                canSubmit && onQueue
                  ? 'bg-foreground text-background shadow-xs hover:bg-foreground/92 active:scale-[0.96] active:bg-foreground/84'
                  : 'bg-muted text-muted-foreground/60'
              )}
            >
              <ArrowUp className="size-3.5" strokeWidth={2.15} />
            </Button>
          )}
        />
        <TooltipContent side="top">{t('chat.composer.queueShortcut')}</TooltipContent>
      </Tooltip>
    </>
  )
}
