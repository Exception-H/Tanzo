import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState
} from '@tanstack/react-table'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3
} from 'lucide-react'
import type { ActivityConversationSummary } from '@shared/activity'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { RunDetailView } from './run-detail/run-detail-view'
import { formatCompact, useTimestampFormatter } from './format'
import type { UsagePageController } from '../model'

interface ConversationListProps {
  controller: UsagePageController
}

export function ConversationList({ controller }: ConversationListProps): React.JSX.Element {
  const { t } = useTranslation()
  const formatTimestamp = useTimestampFormatter()
  const {
    conversations,
    conversationsTotal,
    offset,
    pageSize,
    setOffset,
    selectedRunId,
    setSelectedRunId
  } = controller
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const columns = React.useMemo<ColumnDef<ActivityConversationSummary>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('usage.table.conversation'),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setSelectedRunId(row.original.latestRunId)}
            className="max-w-[360px] truncate text-left font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.title || t('usage.runs.untitled')}
          </button>
        )
      },
      {
        accessorKey: 'modelRef',
        header: t('usage.models.model'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.modelRef}</span>
      },
      {
        accessorKey: 'runCount',
        header: () => <div className="text-right">{t('usage.table.runs')}</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {formatCompact(row.original.runCount)}
          </div>
        )
      },
      {
        accessorKey: 'inputTokens',
        header: () => <div className="text-right">{t('usage.models.input')}</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {formatCompact(row.original.inputTokens)}
          </div>
        )
      },
      {
        accessorKey: 'outputTokens',
        header: () => <div className="text-right">{t('usage.models.output')}</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {formatCompact(row.original.outputTokens)}
          </div>
        )
      },
      {
        accessorKey: 'totalTokens',
        header: () => <div className="text-right">{t('usage.models.total')}</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono font-medium tabular-nums">
            {formatCompact(row.original.totalTokens)}
          </div>
        )
      },
      {
        accessorKey: 'lastRunAt',
        header: t('usage.table.lastRun'),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatTimestamp(row.original.lastRunAt)}
          </span>
        )
      }
    ],
    [formatTimestamp, setSelectedRunId, t]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns callback-bearing instances that React Compiler intentionally skips.
  const table = useReactTable({
    data: conversations,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id
  })

  const selectedConversation = selectedRunId
    ? conversations.find((conversation) => conversation.latestRunId === selectedRunId)
    : undefined
  const currentPage = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(conversationsTotal / pageSize))
  const hasPrev = offset > 0
  const hasNext = offset + pageSize < conversationsTotal

  function goToPage(pageIndex: number): void {
    setOffset(Math.max(0, Math.min(pageIndex, pageCount - 1)) * pageSize)
  }

  return (
    <section className="flex w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t('usage.runs.title')}{' '}
            <span className="text-muted-foreground tabular-nums">({conversationsTotal})</span>
          </p>
          <p className="text-xs text-muted-foreground">{t('usage.table.caption')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="hidden @4xl/main:flex" />}
            >
              <Columns3 data-icon="inline-start" />
              {t('usage.table.columns')}
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {columnLabel(column.id, t)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.original.latestRunId === selectedRunId ? 'selected' : undefined}
                    className={cn(row.original.latestRunId === selectedRunId && 'bg-muted/50')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {t('usage.table.noResults')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {t('usage.table.showing', {
              count: table.getRowModel().rows.length,
              total: conversationsTotal
            })}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              {t('usage.table.page', { page: currentPage, pageCount })}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                disabled={!hasPrev}
                onClick={() => goToPage(0)}
              >
                <span className="sr-only">{t('usage.runs.first')}</span>
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                disabled={!hasPrev}
                onClick={() => goToPage(currentPage - 2)}
              >
                <span className="sr-only">{t('usage.runs.prev')}</span>
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                disabled={!hasNext}
                onClick={() => goToPage(currentPage)}
              >
                <span className="sr-only">{t('usage.runs.next')}</span>
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                disabled={!hasNext}
                onClick={() => goToPage(pageCount - 1)}
              >
                <span className="sr-only">{t('usage.runs.last')}</span>
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={selectedRunId !== null} onOpenChange={(open) => !open && setSelectedRunId(null)}>
        <SheetContent className="w-[min(720px,92vw)] gap-0 sm:max-w-none">
          <SheetHeader className="border-b">
            <SheetTitle className="truncate">
              {selectedConversation?.title || t('usage.runs.untitled')}
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              {selectedConversation ? (
                <>
                  <span>{formatTimestamp(selectedConversation.lastRunAt)}</span>
                  <span className="font-mono">{selectedConversation.modelRef}</span>
                  <span className="font-mono">
                    {t('usage.runs.summary', {
                      runs: selectedConversation.runCount,
                      total: formatCompact(selectedConversation.totalTokens)
                    })}
                  </span>
                </>
              ) : (
                t('usage.runDetail.empty')
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="scrollbar-elegant flex-1 overflow-y-auto p-4">
            <RunDetailView
              detail={controller.runDetail}
              isLoading={controller.isRunDetailLoading}
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

function columnLabel(columnId: string, t: ReturnType<typeof useTranslation>['t']): string {
  const labels: Record<string, string> = {
    title: t('usage.table.conversation'),
    modelRef: t('usage.models.model'),
    runCount: t('usage.table.runs'),
    inputTokens: t('usage.models.input'),
    outputTokens: t('usage.models.output'),
    totalTokens: t('usage.models.total'),
    lastRunAt: t('usage.table.lastRun')
  }
  return labels[columnId] ?? columnId
}
