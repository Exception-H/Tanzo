import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface MessageCopyButtonProps {
  text: string
  className?: string
}

export function MessageCopyButton({
  text,
  className
}: MessageCopyButtonProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  if (!text.trim()) return null

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      void error
    }
  }

  const Icon = copied ? CheckIcon : CopyIcon
  const label = copied ? t('chat.message.copy.copied') : t('chat.message.copy.action')

  return (
    <Tooltip>
      <TooltipTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            aria-label={label}
            className={cn(
              'h-6 w-6 shrink-0 rounded-md border-0 bg-transparent text-muted-foreground/50 shadow-none transition-colors',
              'hover:bg-muted/60 hover:text-muted-foreground',
              className
            )}
          >
            <Icon size={13} className={cn('transition-colors', copied && 'text-emerald-500')} />
          </Button>
        )}
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
