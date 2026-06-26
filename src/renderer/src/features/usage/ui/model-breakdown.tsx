import { useTranslation } from 'react-i18next'
import type { ActivityModelBreakdownRow } from '@shared/activity'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatCompact, formatNumber } from './format'

export function ModelBreakdownTable({
  rows
}: {
  rows: ActivityModelBreakdownRow[]
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-b border-border/50 px-4 py-3">
        <p className="text-[0.8125rem] font-medium text-foreground">{t('usage.models.title')}</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('usage.models.model')}</TableHead>
              <TableHead className="text-right">{t('usage.models.runs')}</TableHead>
              <TableHead className="text-right">{t('usage.models.input')}</TableHead>
              <TableHead className="text-right">{t('usage.models.output')}</TableHead>
              <TableHead className="text-right">{t('usage.models.total')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.provider}:${row.modelRef}`}>
                <TableCell>
                  <span className="text-muted-foreground">{row.provider}</span> {row.modelRef}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.runCount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompact(row.inputTokens)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompact(row.outputTokens)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCompact(row.totalTokens)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
