import { useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { RunNotice as RunNoticeData } from '../../model'

export interface RunNoticeProps {
  notice: RunNoticeData
}

export function RunNotice({ notice }: RunNoticeProps): React.JSX.Element {
  const { t } = useTranslation()
  const [expandedNoticeKey, setExpandedNoticeKey] = useState<string | null>(null)
  const isError = notice.kind === 'error'
  const noticeKey =
    notice.kind === 'retry'
      ? `retry:${notice.retryNumber}:${notice.maxRetries ?? ''}`
      : `error:${notice.error.kind}:${notice.error.statusCode ?? ''}:${notice.error.message}`
  const expanded = expandedNoticeKey === noticeKey

  const retryLabel =
    notice.kind === 'retry'
      ? notice.maxRetries !== undefined
        ? t('chat.runNotice.retry.titleWithMax', {
            count: notice.retryNumber,
            max: notice.maxRetries
          })
        : t('chat.runNotice.retry.title', { count: notice.retryNumber })
      : null
  const error = notice.kind === 'error' ? notice.error : null
  const heading = error
    ? t(`chat.runNotice.error.kind.${error.kind}`, {
        defaultValue: t('chat.runNotice.error.title')
      })
    : null

  const detailRows: Array<{ label: string; value: string }> = []
  if (error) {
    const addDetail = (key: string, value: string | number | boolean | undefined): void => {
      if (value === undefined) return
      detailRows.push({
        label: t(`chat.runNotice.error.detail.${key}`),
        value: String(value)
      })
    }

    addDetail('name', error.name)
    addDetail('provider', error.provider)
    addDetail('modelId', error.modelId)
    addDetail('statusCode', error.statusCode)
    addDetail(
      'retryable',
      error.retryable === undefined
        ? undefined
        : t(`chat.runNotice.error.boolean.${error.retryable ? 'yes' : 'no'}`)
    )
    addDetail('attempts', error.attempts)
    addDetail('reason', error.reason ? t(`chat.runNotice.error.reason.${error.reason}`) : undefined)
    addDetail('toolName', error.toolName)
    addDetail('toolCallId', error.toolCallId)
    addDetail(
      'cause',
      error.cause
        ? error.cause.name
          ? `${error.cause.name}: ${error.cause.message}`
          : error.cause.message
        : undefined
    )
  }

  const modelSummary = error
    ? [error.provider, error.modelId].filter(Boolean).join('/') || undefined
    : undefined

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className="my-5"
    >
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" aria-hidden />
        {error ? (
          <button
            type="button"
            onClick={() =>
              setExpandedNoticeKey((value) => (value === noticeKey ? null : noticeKey))
            }
            aria-expanded={expanded}
            className="group/notice flex max-w-[min(42rem,100%)] shrink-0 items-center gap-1.5 text-[0.6875rem] text-destructive/90 transition-colors hover:text-destructive"
          >
            <AlertTriangle className="size-3 shrink-0" strokeWidth={2} />
            <span className="shrink-0 tracking-wide">{heading}</span>
            {error.statusCode ? (
              <span className="shrink-0 font-mono tabular-nums text-destructive/55">
                {error.statusCode}
              </span>
            ) : null}
            {modelSummary ? (
              <span className="min-w-0 truncate font-mono text-destructive/55">{modelSummary}</span>
            ) : null}
            {error.attempts !== undefined ? (
              <span className="shrink-0 text-destructive/55">
                {t('chat.runNotice.error.summary.attempts', { count: error.attempts })}
              </span>
            ) : null}
            <ChevronDown
              aria-hidden
              className={cn(
                'size-3 shrink-0 text-destructive/40 transition-transform duration-200 group-hover/notice:text-destructive/70',
                expanded && 'rotate-180'
              )}
              strokeWidth={2.2}
            />
          </button>
        ) : (
          <span className="shrink-0 animate-pulse text-[0.6875rem] tracking-wide text-muted-foreground">
            {retryLabel}
          </span>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" aria-hidden />
      </div>
      {error && expanded ? (
        <div className="mx-auto mt-3 max-w-2xl rounded-lg border border-destructive/15 bg-destructive/[0.03] p-3 text-[0.6875rem] leading-relaxed">
          {detailRows.length > 0 ? (
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {detailRows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-muted-foreground/60">{row.label}</dt>
                  <dd className="min-w-0 break-words font-mono text-muted-foreground/90">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className={cn(detailRows.length > 0 && 'mt-3 border-t border-destructive/10 pt-3')}>
            <div className="text-muted-foreground/60">
              {t('chat.runNotice.error.detail.message')}
            </div>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed text-muted-foreground/80">
              {error.message}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}
