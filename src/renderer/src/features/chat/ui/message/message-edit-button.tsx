import { PencilIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface MessageEditButtonProps {
  onEdit: () => void
  className?: string
}

export function MessageEditButton({
  onEdit,
  className
}: MessageEditButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const label = t('chat.message.edit.action')

  return (
    <Tooltip>
      <TooltipTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={label}
            className={cn(
              'h-6 w-6 shrink-0 rounded-md border-0 bg-transparent text-muted-foreground/50 shadow-none transition-colors',
              'hover:bg-muted/60 hover:text-muted-foreground',
              className
            )}
          >
            <PencilIcon size={13} />
          </Button>
        )}
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
