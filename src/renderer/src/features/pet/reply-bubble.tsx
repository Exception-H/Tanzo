import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PetReplyRef } from '@shared/pet'
import { ToolBody, ToolPanel } from '@/features/chat/ui/tool/primitives'

interface ReplyBubbleProps {
  reply: PetReplyRef
  onOpen: () => void
}

export function ReplyBubble({ reply, onOpen }: ReplyBubbleProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="not-prose w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-xl)] border border-border/60 bg-card shadow-lg">
      <ToolBody className="p-0">
        <ToolPanel tone="default">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer space-y-1.5 px-2.5 py-2 text-left"
          >
            <header className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-foreground/72">
              <Sparkles className="size-3 shrink-0 text-primary" strokeWidth={1.8} />
              <span className="min-w-0 flex-1 truncate">{t('pet.reply.title')}</span>
              <span className="shrink-0 text-[0.5625rem] font-normal text-muted-foreground">
                {t('pet.reply.open')}
              </span>
            </header>
            <p className="text-[0.75rem] leading-relaxed break-words text-foreground/85">
              {reply.text}
            </p>
          </button>
        </ToolPanel>
      </ToolBody>
    </div>
  )
}
