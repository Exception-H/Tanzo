import { useTranslation } from 'react-i18next'
import type { ActivityRunDetail } from '@shared/activity'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatCompact } from '../format'

interface RunDetailViewProps {
  detail: ActivityRunDetail | undefined
  isLoading: boolean
}

export function RunDetailView({ detail, isLoading }: RunDetailViewProps): React.JSX.Element {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-4 text-muted-foreground" />
      </div>
    )
  }

  if (!detail?.run) {
    return (
      <p className="px-4 py-6 text-center text-[0.6875rem] text-muted-foreground">
        {t('usage.runDetail.empty')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[0.6875rem] font-medium text-foreground">
          {t('usage.runDetail.steps')}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead className="text-right">{t('usage.runDetail.input')}</TableHead>
              <TableHead className="text-right">{t('usage.runDetail.output')}</TableHead>
              <TableHead className="text-right">{t('usage.runDetail.cacheRead')}</TableHead>
              <TableHead className="text-right">{t('usage.runDetail.total')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.steps.map((step) => (
              <TableRow key={step.stepNumber}>
                <TableCell className="tabular-nums">{step.stepNumber}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompact(step.inputTokens ?? 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompact(step.outputTokens ?? 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompact(step.cacheReadTokens ?? 0)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCompact(step.totalTokens ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
