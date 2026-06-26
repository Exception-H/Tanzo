import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

import { ShimmeringText } from '../shared/shimmering-text'

const STREAMING_MESSAGE_KEYS = [
  'chat.message.streamingIndicator.messages.pullingSignal',
  'chat.message.streamingIndicator.messages.cuttingFluff',
  'chat.message.streamingIndicator.messages.plainLanguage',
  'chat.message.streamingIndicator.messages.straighteningLogic',
  'chat.message.streamingIndicator.messages.tighteningWording',
  'chat.message.streamingIndicator.messages.deeperPass',
  'chat.message.streamingIndicator.messages.actionableAnswer',
  'chat.message.streamingIndicator.messages.skippingDetours',
  'chat.message.streamingIndicator.messages.polishingUsefulBits',
  'chat.message.streamingIndicator.messages.honestAnswer',
  'chat.message.streamingIndicator.messages.nextMove',
  'chat.message.streamingIndicator.messages.untanglingMess',
  'chat.message.streamingIndicator.messages.sharpeningConclusion',
  'chat.message.streamingIndicator.messages.reducingAiAftertaste',
  'chat.message.streamingIndicator.messages.fillingGaps',
  'chat.message.streamingIndicator.messages.makingItLand',
  'chat.message.streamingIndicator.messages.almostToThePoint',
  'chat.message.streamingIndicator.messages.finalPolish',
  'chat.message.streamingIndicator.messages.finalDraft',
  'chat.message.streamingIndicator.messages.notGhosting'
] as const

export interface StreamingIndicatorProps {
  label?: string
  interval?: number
  className?: string
}

export function StreamingIndicator({
  label,
  interval = 3000,
  className
}: StreamingIndicatorProps): React.JSX.Element {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const messages = STREAMING_MESSAGE_KEYS.map((key) => t(key))

  useEffect(() => {
    if (label) return undefined
    const id = window.setInterval(() => {
      const count = messages.length
      setIndex((current) => (count > 0 ? (current + 1) % count : 0))
    }, interval)
    return () => window.clearInterval(id)
  }, [interval, label, messages.length])

  const activeMessage =
    label ??
    messages[index % messages.length] ??
    messages[0] ??
    t('chat.message.streamingIndicator.fallback')

  return (
    <div className={cn('flex items-center gap-1.5 pt-2', className)}>
      <ShimmeringText
        key={label ? activeMessage : index}
        text={activeMessage}
        className="text-[0.6875rem] italic animate-in fade-in duration-300"
        duration={3}
        repeat
        repeatDelay={0}
        spread={3}
      />
    </div>
  )
}
