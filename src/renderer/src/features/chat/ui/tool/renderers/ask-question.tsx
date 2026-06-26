import { useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleDashed,
  CircleHelp,
  MessagesSquare,
  Send
} from 'lucide-react'
import type {
  AskQuestionAnswer,
  AskQuestionItem,
  AskQuestionOption,
  AskQuestionType,
  TanzoTools,
  ToolError
} from '@shared/agent-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useChatActions } from '../../../chat-actions-context'
import { ToolHeaderRow, ToolMetaChip } from '../primitives'
import { isPendingState, type ToolRenderContext } from '../render-context'
import type { ToolRenderer } from '../renderer-types'
import { renderToolError } from './render-error'

type AskInput = Partial<TanzoTools['askQuestion']['input']>
type AskOutput = Exclude<TanzoTools['askQuestion']['output'], ToolError>
type TFn = ReturnType<typeof useTranslation>['t']

interface Draft {
  values: string[]
  custom: string
}

const TYPE_KEY: Record<AskQuestionType, string> = {
  single_select: 'chat.question.type.single',
  multi_select: 'chat.question.type.multi',
  rank_priorities: 'chat.question.type.rank'
}

function safeType(value: unknown): AskQuestionType {
  return value === 'multi_select' || value === 'rank_priorities' || value === 'single_select'
    ? value
    : 'single_select'
}

function questions(input: AskInput | undefined): AskQuestionItem[] {
  const raw = Array.isArray(input?.questions) ? input.questions : []
  return raw.map((item, index) => ({
    ...item,
    id: item?.id || `q${index}`,
    title: item?.title ?? '',
    prompt: item?.prompt ?? '',
    type: safeType(item?.type),
    options: Array.isArray(item?.options) ? item.options : []
  }))
}

function questionType(item: AskQuestionItem): AskQuestionType {
  return safeType(item.type)
}

function labelFor(item: AskQuestionItem, value: string): string {
  return item.options?.find((option) => option.value === value)?.label ?? value
}

function QuestionStatusIcon({ completed }: { completed: boolean }): React.JSX.Element {
  if (completed) return <CircleCheckBig className="size-3 shrink-0 text-emerald-500/80" />
  return <CircleDashed className="size-3 shrink-0 text-foreground/30" />
}

function isDeclined(
  output: AskOutput | undefined
): output is Extract<AskOutput, { declined: true }> {
  return Boolean(output && 'declined' in output)
}

function AskQuestionHeader({ context }: { context: ToolRenderContext }): React.JSX.Element {
  const { t } = useTranslation()
  const list = questions(context.input as AskInput | undefined)
  const output =
    typeof context.output === 'object' && context.output !== null && !('error' in context.output)
      ? (context.output as AskOutput)
      : undefined
  const meta = isDeclined(output)
    ? t('chat.question.meta.discussing')
    : output && 'answers' in output
      ? t('chat.question.meta.answered', { done: output.answers.length, total: list.length })
      : list.length > 0
        ? t('chat.question.meta.count', { count: list.length })
        : undefined
  return (
    <ToolHeaderRow
      icon={CircleHelp}
      label={t('chat.question.label')}
      title={list[0]?.title || t('chat.question.waiting')}
      state={context.state}
      meta={meta ? <ToolMetaChip text={meta} /> : null}
    />
  )
}

function AskQuestionOutputComp({
  context
}: {
  context: ToolRenderContext
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const err = renderToolError(context, t('chat.question.error'), { className: 'm-3' })
  if (err) return err

  const input = context.input as AskInput | undefined
  const list = questions(input)
  const output = context.output as AskOutput | undefined

  if (isDeclined(output)) return <DeclinedNotice note={output.note} t={t} />
  if (output && 'answers' in output)
    return <AnsweredQuestions items={list} answers={output.answers} t={t} />

  if (list.length === 0) {
    return isPendingState(context.state) ? <QuestionsSkeleton t={t} /> : null
  }
  return <PendingQuestions context={context} items={list} t={t} />
}

function QuestionsSkeleton({ t }: { t: TFn }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-3.5 py-3 text-[0.6875rem] text-muted-foreground/60">
      <CircleHelp className="size-3.5 shrink-0 animate-pulse text-muted-foreground/50" />
      {t('chat.question.decoding')}
    </div>
  )
}

function DeclinedNotice({ note, t }: { note?: string; t: TFn }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 px-3.5 py-3 text-[0.75rem] leading-relaxed">
      <MessagesSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
      <div className="min-w-0">
        <span className="font-medium text-foreground">{t('chat.question.declined.title')} </span>
        <span className="text-muted-foreground/80">
          {note ?? t('chat.question.declined.default')}
        </span>
      </div>
    </div>
  )
}

function AnsweredQuestions({
  items,
  answers,
  t
}: {
  items: AskQuestionItem[]
  answers: AskQuestionAnswer[]
  t: TFn
}): React.JSX.Element {
  const byId = new Map(answers.map((answer) => [answer.id, answer]))
  return (
    <div className="scrollbar-elegant max-h-[20rem] overflow-auto">
      {items.map((item, index) => {
        const answer = byId.get(item.id)
        const display = answer
          ? answer.values.map((value, idx) => answer.labels?.[idx] ?? value)
          : []
        return (
          <div
            key={item.id}
            className={cn('px-3.5 py-2.5', index > 0 && 'border-t border-border/10')}
          >
            <div className="mb-1 text-[0.75rem] font-medium text-foreground">{item.prompt}</div>
            <div className="text-[0.75rem] leading-relaxed text-muted-foreground">
              {display.length === 0 ? (
                t('chat.question.noAnswer')
              ) : questionType(item) === 'rank_priorities' ? (
                <ol className="space-y-0.5">
                  {answer?.values.map((value, idx) => {
                    const entry = answer.labels?.[idx] ?? value
                    return (
                      <li key={value} className="text-foreground/85">
                        <span className="mr-1.5 tabular-nums text-muted-foreground/60">
                          {idx + 1}.
                        </span>
                        {entry}
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <span className="text-foreground/85">{display.join(', ')}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PendingQuestions({
  context,
  items,
  t
}: {
  context: ToolRenderContext
  items: AskQuestionItem[]
  t: TFn
}): React.JSX.Element {
  const actions = useChatActions()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [requestedIndex, setRequestedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const currentIndex = Math.min(requestedIndex, Math.max(items.length - 1, 0))

  function rankOrder(item: AskQuestionItem): string[] {
    const optionValues = item.options.map((option) => option.value)
    const stored = (drafts[item.id]?.values ?? []).filter((value) => optionValues.includes(value))
    const missing = optionValues.filter((value) => !stored.includes(value))
    return [...stored, ...missing]
  }

  function draftFor(item: AskQuestionItem): Draft {
    return drafts[item.id] ?? { values: [], custom: '' }
  }

  function update(id: string, patch: Partial<Draft>): void {
    setError(null)
    setDrafts((previous) => ({
      ...previous,
      [id]: { ...(previous[id] ?? { values: [], custom: '' }), ...patch }
    }))
  }

  function selectSingle(item: AskQuestionItem, value: string): void {
    update(item.id, { values: [value], custom: '' })
  }

  function toggleMulti(item: AskQuestionItem, value: string): void {
    const current = draftFor(item).values
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]
    update(item.id, { values: next, custom: '' })
  }

  function moveRank(item: AskQuestionItem, index: number, direction: -1 | 1): void {
    const current = rankOrder(item)
    const target = index + direction
    if (target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    update(item.id, { values: current })
  }

  function answered(item: AskQuestionItem): boolean {
    const draft = draftFor(item)
    if (questionType(item) === 'rank_priorities') {
      return item.options.length > 0 && rankOrder(item).length === item.options.length
    }
    if (draft.custom.trim()) return item.allowCustom === true
    return draft.values.length > 0
  }

  const completedItems = items.map((item) => ({ id: item.id, completed: answered(item) }))
  const canSubmit = completedItems.every((item) => item.completed)

  const currentItem = items[currentIndex] ?? items[0]
  const currentAnswered = completedItems[currentIndex]?.completed ?? false
  const isFirstPage = currentIndex === 0
  const isLastPage = currentIndex === items.length - 1

  const statusText = canSubmit
    ? t('chat.question.ready')
    : isLastPage
      ? t('chat.question.needsAll')
      : currentAnswered
        ? t('chat.question.currentReady')
        : t('chat.question.canBrowse')

  function goPrevious(): void {
    setRequestedIndex((index) => Math.max(index - 1, 0))
  }

  function goNext(): void {
    setRequestedIndex((index) => Math.min(index + 1, items.length - 1))
  }

  function primaryAction(): void {
    if (isLastPage) submit()
    else goNext()
  }

  const primaryDisabled = pending || (isLastPage ? !actions || !canSubmit : false)

  function buildAnswer(item: AskQuestionItem): AskQuestionAnswer {
    const draft = draftFor(item)
    const type = questionType(item)
    if (type !== 'rank_priorities' && draft.custom.trim()) {
      return { id: item.id, type, values: [draft.custom.trim()], custom: true }
    }
    const values = type === 'rank_priorities' ? rankOrder(item) : draft.values
    return {
      id: item.id,
      type,
      values,
      labels: values.map((value) => labelFor(item, value)),
      custom: false
    }
  }

  function runAction(action: () => Promise<void>): void {
    setError(null)
    startTransition(async () => {
      try {
        await action()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
  }

  function submit(): void {
    if (!actions || !canSubmit) return
    const answers = items.map(buildAnswer)
    runAction(() => actions.respondToQuestion({ questionId: context.toolCallId, answers }))
  }

  function decline(): void {
    if (!actions) return
    runAction(() => actions.respondToQuestion({ questionId: context.toolCallId, declined: true }))
  }

  return (
    <>
      {currentItem ? (
        <QuestionBlock
          item={currentItem}
          draft={draftFor(currentItem)}
          rankOrder={rankOrder(currentItem)}
          pending={pending}
          page={
            items.length > 1
              ? t('chat.question.page', { current: currentIndex + 1, total: items.length })
              : undefined
          }
          completed={currentAnswered}
          t={t}
          onSelectSingle={(value) => selectSingle(currentItem, value)}
          onToggleMulti={(value) => toggleMulti(currentItem, value)}
          onMoveRank={(idx, direction) => moveRank(currentItem, idx, direction)}
          onCustom={(text) => update(currentItem.id, { custom: text, values: [] })}
          onSubmit={primaryAction}
        />
      ) : null}
      <div className="border-t border-border/8">
        {error ? (
          <p className="px-3.5 pt-1.5 text-[0.625rem] text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="min-w-0 truncate text-[0.625rem] tabular-nums text-muted-foreground/65">
            {statusText}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={!actions || pending}
              onClick={decline}
              className="h-7 gap-1 px-2 text-[0.6875rem] text-muted-foreground hover:text-foreground"
            >
              <MessagesSquare className="size-3" />
              {t('chat.question.discuss')}
            </Button>
            {items.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending || isFirstPage}
                onClick={goPrevious}
                className="h-7 gap-1 px-2 text-[0.6875rem] text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-3" />
                {t('chat.question.previous')}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={primaryDisabled}
              onClick={primaryAction}
              className="h-7 gap-1 px-3 text-[0.6875rem]"
            >
              {isLastPage ? <Send className="size-3" /> : <ChevronRight className="size-3" />}
              {isLastPage
                ? t('chat.question.send', { count: items.length })
                : t('chat.question.next')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

function QuestionBlock({
  item,
  draft,
  rankOrder,
  pending,
  page,
  completed,
  t,
  onSelectSingle,
  onToggleMulti,
  onMoveRank,
  onCustom,
  onSubmit
}: {
  item: AskQuestionItem
  draft: Draft
  rankOrder: string[]
  pending: boolean
  page?: string
  completed: boolean
  t: TFn
  onSelectSingle: (value: string) => void
  onToggleMulti: (value: string) => void
  onMoveRank: (index: number, direction: -1 | 1) => void
  onCustom: (text: string) => void
  onSubmit?: () => void
}): React.JSX.Element {
  const type = questionType(item)
  const allowCustom = item.allowCustom === true && type !== 'rank_priorities'
  const selectedCount = draft.values.length
  const typeText =
    type === 'multi_select' && selectedCount > 0
      ? t('chat.question.selected', { count: selectedCount })
      : type === 'rank_priorities' && rankOrder.length > 0
        ? t('chat.question.ranked', { count: rankOrder.length })
        : t(TYPE_KEY[type] ?? TYPE_KEY.single_select)
  return (
    <div className="py-0.5">
      <div className="px-3 py-1.5">
        <div className="mb-0.5 flex items-center gap-1.5 text-[0.625rem] leading-relaxed text-muted-foreground/55">
          {page ? (
            <>
              <QuestionStatusIcon completed={completed} />
              <span className="font-medium text-muted-foreground/70">{page}</span>
              <span className="text-muted-foreground/25">·</span>
            </>
          ) : null}
          <span>{typeText}</span>
        </div>
        <p className="text-[0.75rem] leading-relaxed text-foreground/90">
          {item.title ? <span className="font-medium">{item.title}</span> : null}
          {item.title && item.prompt ? <span className="text-muted-foreground/35"> — </span> : null}
          {item.prompt ? (
            <span className={item.title ? 'text-muted-foreground/80' : undefined}>
              {item.prompt}
            </span>
          ) : null}
        </p>
      </div>
      {type === 'rank_priorities' ? (
        <RankList item={item} order={rankOrder} pending={pending} onMove={onMoveRank} t={t} />
      ) : item.options.length > 0 ? (
        <div className="py-0.5" role={type === 'single_select' ? 'radiogroup' : 'group'}>
          {item.options.map((option) => (
            <OptionRow
              key={`${item.id}:${option.value}`}
              option={option}
              active={draft.values.includes(option.value)}
              multi={type === 'multi_select'}
              pending={pending}
              onClick={() =>
                type === 'multi_select' ? onToggleMulti(option.value) : onSelectSingle(option.value)
              }
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-1 text-[0.6875rem] text-muted-foreground/55">
          {t('chat.question.loadingOptions')}
        </div>
      )}
      {allowCustom ? (
        <div className="px-3 pb-2 pt-1">
          <Input
            disabled={pending}
            placeholder={t('chat.question.customPlaceholder')}
            value={draft.custom}
            onChange={(event) => onCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && onSubmit) {
                event.preventDefault()
                onSubmit()
              }
            }}
            className="h-8 border-border/10 bg-transparent px-3 text-[0.75rem] placeholder:text-muted-foreground/45"
          />
        </div>
      ) : null}
    </div>
  )
}

function OptionRow({
  option,
  active,
  multi,
  pending,
  onClick
}: {
  option: AskQuestionOption
  active: boolean
  multi: boolean
  pending: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={active}
      onClick={onClick}
      disabled={pending}
      className={cn(
        'flex w-full items-start gap-2 px-3 py-1 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/35',
        active ? 'bg-foreground/[0.035]' : 'hover:bg-foreground/[0.035]',
        pending && 'cursor-not-allowed opacity-60'
      )}
    >
      <QuestionStatusIcon completed={active} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'text-[0.75rem]',
            active ? 'font-medium text-foreground' : 'text-foreground/90'
          )}
        >
          {option.label}
        </span>
        {option.description ? (
          <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-muted-foreground/70">
            {option.description}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function RankList({
  item,
  order,
  pending,
  onMove,
  t
}: {
  item: AskQuestionItem
  order: string[]
  pending: boolean
  onMove: (index: number, direction: -1 | 1) => void
  t: TFn
}): React.JSX.Element {
  return (
    <div className="py-1">
      {order.map((value, index) => {
        const option = item.options.find((entry) => entry.value === value)
        return (
          <div
            key={`${item.id}:${value}`}
            className="flex items-start gap-2 px-3 py-1 transition-colors hover:bg-foreground/[0.035]"
          >
            <span className="mt-px flex size-3 shrink-0 items-center justify-center rounded-full text-[0.625rem] tabular-nums text-muted-foreground/60">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.75rem] leading-snug text-foreground/90">
                {option?.label ?? value}
              </span>
              {option?.description ? (
                <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-muted-foreground/70">
                  {option.description}
                </span>
              ) : null}
            </span>
            <div className="mt-0.5 flex shrink-0 items-center">
              <button
                type="button"
                disabled={pending || index === 0}
                onClick={() => onMove(index, -1)}
                className="rounded p-0.5 text-muted-foreground/55 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-25"
                aria-label={t('chat.question.moveUp')}
                title={t('chat.question.moveUp')}
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={pending || index === order.length - 1}
                onClick={() => onMove(index, 1)}
                className="rounded p-0.5 text-muted-foreground/55 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-25"
                aria-label={t('chat.question.moveDown')}
                title={t('chat.question.moveDown')}
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const askQuestionRenderer: ToolRenderer = {
  Header: AskQuestionHeader,
  Output: AskQuestionOutputComp,
  renderWhenPending: true,
  fullBleed: true
}
