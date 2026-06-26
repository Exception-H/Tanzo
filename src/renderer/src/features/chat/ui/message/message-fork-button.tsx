import { useState } from 'react'
import { GitBranchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface MessageForkButtonProps {
  onFork?: () => void | Promise<void>
  className?: string
}

export function MessageForkButton({
  onFork,
  className
}: MessageForkButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  const handleFork = async (): Promise<void> => {
    if (pending || !onFork) return
    setPending(true)
    try {
      await onFork()
    } finally {
      setPending(false)
    }
  }

  const label = pending
    ? t('chat.message.fork.pending')
    : onFork
      ? t('chat.message.fork.action')
      : t('chat.message.fork.placeholder')

  return (
    <Tooltip>
      <TooltipTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleFork}
            disabled={pending || !onFork}
            aria-label={label}
            className={cn(
              'h-6 w-6 shrink-0 rounded-md border-0 bg-transparent text-muted-foreground/50 shadow-none transition-colors',
              'hover:bg-muted/60 hover:text-muted-foreground',
              !onFork &&
                'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground/50',
              className
            )}
          >
            {pending ? <Spinner className="h-[13px] w-[13px]" /> : <GitBranchIcon size={13} />}
          </Button>
        )}
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
