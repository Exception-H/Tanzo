import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { COPY_FEEDBACK_TIMEOUT } from './copy-constants'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface CopyButtonProps {
  text: string
  className?: string
}

export function CopyButton({ text, className }: CopyButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const label = copied ? t('chat.message.copy.copied') : t('chat.message.copy.action')
  return (
    <Tooltip>
      <TooltipTrigger
        render={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation()
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT)
              })
            }}
            className={cn(
              'flex size-5 items-center justify-center rounded-md bg-background/60 text-muted-foreground ring-1 ring-inset ring-border/15 backdrop-blur-sm transition-colors hover:text-foreground',
              className
            )}
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <output className="sr-only" aria-live="polite">
              {copied ? t('chat.message.copy.copied') : ''}
            </output>
          </button>
        )}
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
