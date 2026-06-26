import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActivityKpis } from '@shared/activity'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { formatCompact, formatPercent } from './format'

interface KpiCardsProps {
  kpis: ActivityKpis
}

interface KpiCard {
  label: string
  value: string
  badge: { text: string; tone: 'good' | 'neutral' }
  footLead: string
  footHint: string
}

export function KpiCards({ kpis }: KpiCardsProps): ReactNode {
  const { t } = useTranslation()

  const cacheHigh = kpis.cacheHitRatio >= 0.5

  const cards: KpiCard[] = [
    {
      label: t('usage.kpis.totalTokens'),
      value: formatCompact(kpis.totalTokens),
      badge: { text: `${formatCompact(kpis.runCount)} ⚡`, tone: 'neutral' },
      footLead: t('usage.kpis.tokensLead'),
      footHint: t('usage.kpis.tokensHint', { runs: kpis.runCount })
    },
    {
      label: t('usage.kpis.inputTokens'),
      value: formatCompact(kpis.inputTokens),
      badge: {
        text: `↓ ${formatPercent(share(kpis.inputTokens, kpis.totalTokens))}`,
        tone: 'neutral'
      },
      footLead: t('usage.kpis.inputLead'),
      footHint: t('usage.kpis.cacheHint', {
        read: formatCompact(kpis.cacheReadTokens),
        write: formatCompact(kpis.cacheWriteTokens)
      })
    },
    {
      label: t('usage.kpis.outputTokens'),
      value: formatCompact(kpis.outputTokens),
      badge: {
        text: `↑ ${formatPercent(share(kpis.outputTokens, kpis.totalTokens))}`,
        tone: 'neutral'
      },
      footLead: t('usage.kpis.outputLead'),
      footHint: t('usage.kpis.outputHint')
    },
    {
      label: t('usage.kpis.cacheHitRatio'),
      value: formatPercent(kpis.cacheHitRatio),
      badge: {
        text: formatPercent(kpis.cacheHitRatio),
        tone: cacheHigh ? 'good' : 'neutral'
      },
      footLead: cacheHigh ? t('usage.kpis.cacheLeadGood') : t('usage.kpis.cacheLeadLow'),
      footHint: t('usage.kpis.cacheHint', {
        read: formatCompact(kpis.cacheReadTokens),
        write: formatCompact(kpis.cacheWriteTokens)
      })
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @md/main:grid-cols-2 @3xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label} size="sm" className="@container/card gap-3">
          <CardHeader>
            <CardDescription className="text-[0.6875rem]">{card.label}</CardDescription>
            <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[200px]/card:text-3xl">
              {card.value}
            </CardTitle>
            <CardAction>
              <Badge variant={badgeVariant(card.badge.tone)} className="gap-1 font-mono">
                {card.badge.text}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[0.6875rem]">
            <div className="font-medium text-foreground/90">{card.footLead}</div>
            <div className="font-mono text-[0.625rem] text-muted-foreground">{card.footHint}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0
}

function badgeVariant(tone: 'good' | 'neutral'): 'secondary' | 'outline' {
  return tone === 'good' ? 'secondary' : 'outline'
}
