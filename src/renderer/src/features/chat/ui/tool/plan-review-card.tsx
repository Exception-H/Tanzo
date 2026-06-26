import { useState, useTransition } from 'react'
import { Check, ClipboardList, Download, Rocket, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UIMessagePart } from 'ai'
import type { PermissionMode } from '@shared/policy'
import { Button } from '@/components/ui/button'
import { useChatActions } from '../../chat-actions-context'
import { usePolicyMode } from '../../model/queries'
import { useSetPolicyMode } from '../../model/mutations'
import { Response } from '../message/response'
import { buildToolRenderContext } from './render-context'
import { CopyButton, ToolBadge, ToolScrollPanel, type ToolBadgeTone } from './primitives'

export interface PlanReviewCardProps {
  part: UIMessagePart<never, never>
}

function planText(input: unknown): string {
  if (
    input &&
    typeof input === 'object' &&
    typeof (input as { plan?: unknown }).plan === 'string'
  ) {
    return (input as { plan: string }).plan
  }
  return ''
}

function downloadMarkdown(text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'plan.md'
  anchor.click()
  URL.revokeObjectURL(url)
}

interface PlanDownloadButtonProps {
  text: string
  label: string
}

function PlanDownloadButton({ text, label }: PlanDownloadButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        downloadMarkdown(text)
      }}
      className="flex size-5 items-center justify-center rounded-md bg-background/60 text-muted-foreground ring-1 ring-inset ring-border/15 backdrop-blur-sm transition-colors hover:text-foreground"
    >
      <Download className="size-3" />
    </button>
  )
}

interface PlanApprovalProps {
  disabled: boolean
  onApprove: (mode: PermissionMode) => void
  onReject: () => void
  error: string | null
}

function PlanApproval({
  disabled,
  onApprove,
  onReject,
  error
}: PlanApprovalProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="border-t border-border/15 bg-muted/20 px-2.5 py-1.5">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <Button
          variant="destructive"
          size="sm"
          className="h-7 min-w-0 gap-1 px-1.5 text-[0.6875rem]"
          disabled={disabled}
          onClick={onReject}
        >
          <XCircle className="size-3" />
          <span className="min-w-0 truncate">{t('chat.planReview.reject')}</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 min-w-0 gap-1 px-1.5 text-[0.6875rem]"
          disabled={disabled}
          onClick={() => onApprove('yolo')}
        >
          <Rocket className="size-3" />
          <span className="min-w-0 truncate">{t('chat.planReview.autoRun')}</span>
        </Button>
        <Button
          size="sm"
          className="h-7 min-w-0 gap-1 bg-emerald-600 px-1.5 text-[0.6875rem] text-white hover:bg-emerald-700"
          disabled={disabled}
          onClick={() => onApprove('default')}
        >
          <Check className="size-3" />
          <span className="min-w-0 truncate">{t('chat.planReview.approveExecute')}</span>
        </Button>
      </div>
      {error ? (
        <p className="mt-1.5 text-[0.625rem] text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  )
}

export function PlanReviewCard({ part }: PlanReviewCardProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const actions = useChatActions()
  const setMode = useSetPolicyMode()
  const currentMode = usePolicyMode(actions?.chatId)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const ctx = buildToolRenderContext({ part })
  if (!ctx) return null

  const plan = planText(ctx.input)
  const approvalId = ctx.approval?.id
  const awaiting = ctx.state === 'approval-requested' && Boolean(approvalId)
  const approved = ctx.approval?.approved

  function approve(mode: PermissionMode): void {
    if (!actions || !approvalId) return
    setError(null)
    const chatId = actions.chatId
    startTransition(async () => {
      try {
        const previousMode = currentMode.data
        let modeChanged = false
        await setMode.mutateAsync({ mode, chatId })
        modeChanged = true
        try {
          await actions.respondToApprovals([{ approvalId, approved: true }])
        } catch (err) {
          if (previousMode && previousMode !== mode && modeChanged) {
            await setMode.mutateAsync({ mode: previousMode, chatId }).catch(() => undefined)
          }
          throw err
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  function reject(): void {
    if (!actions || !approvalId) return
    setError(null)
    startTransition(async () => {
      try {
        await actions.respondToApprovals([{ approvalId, approved: false }])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  const badge: { text: string; tone: ToolBadgeTone } | null =
    approved === true
      ? { text: t('chat.planReview.approved'), tone: 'success' }
      : approved === false
        ? { text: t('chat.planReview.rejected'), tone: 'danger' }
        : null

  return (
    <div className="not-prose mb-2.5 overflow-hidden rounded-[var(--radius-xl)] border border-border/15 bg-card/85 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border/15 bg-muted/20 px-2.5 py-1.5">
        <span className="flex size-4 shrink-0 items-center justify-center rounded-md bg-muted/35 ring-1 ring-inset ring-border/15">
          <ClipboardList className="size-3 text-primary" />
        </span>
        <div className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-foreground/92">
          {t('chat.planReview.title')}
        </div>
        {plan ? (
          <div className="flex shrink-0 items-center gap-1">
            <CopyButton text={plan} />
            <PlanDownloadButton text={plan} label={t('chat.planReview.download')} />
          </div>
        ) : null}
        {badge ? (
          <ToolBadge text={badge.text} tone={badge.tone} />
        ) : awaiting ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] tabular-nums text-amber-600 dark:text-amber-400">
            {t('chat.planReview.pending')}
          </span>
        ) : null}
      </div>

      <div className="px-2.5 py-2">
        <ToolScrollPanel tone="subtle" maxHeight="26rem" contentClassName="px-3 py-2.5">
          <Response content={plan} />
        </ToolScrollPanel>
      </div>

      {awaiting ? (
        <PlanApproval
          disabled={pending || !actions}
          onApprove={approve}
          onReject={reject}
          error={error}
        />
      ) : null}
    </div>
  )
}
