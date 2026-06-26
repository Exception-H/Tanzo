import { ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ScrollToBottomButtonProps {
  visible: boolean
  onClick: () => void
  className?: string
}

export function ScrollToBottomButton({
  visible,
  onClick,
  className
}: ScrollToBottomButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'pointer-events-auto z-30 transition-all duration-200',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onClick}
        aria-label={t('chat.message.scrollToBottom')}
        className="size-8 rounded-full border-muted-foreground/20 bg-background/85 text-muted-foreground shadow-md backdrop-blur hover:bg-background hover:text-foreground"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
