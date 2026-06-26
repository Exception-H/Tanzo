import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ActivityTrend } from '@shared/activity'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { formatCompact } from './format'

interface UsageTrendChartProps {
  trend: ActivityTrend
}

function useBucketFormatter(unit: ActivityTrend['unit']): (ms: number) => string {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const options: Intl.DateTimeFormatOptions =
      unit === 'hour'
        ? { hour: '2-digit', minute: '2-digit' }
        : unit === 'month'
          ? { year: 'numeric', month: 'short' }
          : { month: 'short', day: 'numeric' }
    const formatter = new Intl.DateTimeFormat(i18n.language, options)
    return (ms) => formatter.format(new Date(ms))
  }, [i18n.language, unit])
}

export function UsageTrendChart({ trend }: UsageTrendChartProps): ReactNode {
  const { t } = useTranslation()
  const formatBucket = useBucketFormatter(trend.unit)

  const { data, total } = useMemo(() => {
    const points = trend.points.map((point) => ({
      label: formatBucket(point.bucketStart),
      inputTokens: point.inputTokens,
      outputTokens: point.outputTokens
    }))
    const sum = trend.points.reduce((acc, point) => acc + point.inputTokens + point.outputTokens, 0)
    return { data: points, total: sum }
  }, [trend.points, formatBucket])

  const config: ChartConfig = {
    inputTokens: { label: t('usage.charts.input'), color: 'var(--chart-1)' },
    outputTokens: { label: t('usage.charts.output'), color: 'var(--chart-2)' }
  }

  return (
    <Card className="@container/card flex flex-col">
      <CardHeader>
        <CardTitle className="text-[0.875rem]">{t('usage.charts.trend')}</CardTitle>
        <CardDescription className="text-[0.6875rem]">
          {t('usage.charts.trendHint')}
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-mono">
            {formatCompact(total)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
          <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 10, top: 8 }}>
            <defs>
              <linearGradient id="usageFillInput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-inputTokens)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-inputTokens)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="usageFillOutput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-outputTokens)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-outputTokens)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              fontSize={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              fontSize={10}
              tickFormatter={(value: number) => formatCompact(value)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="inputTokens"
              type="monotone"
              fill="url(#usageFillInput)"
              fillOpacity={1}
              stroke="var(--color-inputTokens)"
              strokeWidth={2}
              stackId="a"
            />
            <Area
              dataKey="outputTokens"
              type="monotone"
              fill="url(#usageFillOutput)"
              fillOpacity={1}
              stroke="var(--color-outputTokens)"
              strokeWidth={2}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
