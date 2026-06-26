import { randomUUID } from 'node:crypto'
import { convertToModelMessages, type ModelMessage } from 'ai'
import type { TanzoDataParts, TanzoUIMessage, TanzoUsageMetadata } from '@shared/agent-message'
import { canonicalizeToolTranscript } from '../tool-transcript'
import { findCut, isSummaryMessage, partitionAtCut, type Partition } from './segments'
import { stripAnalysis } from './prompt'

export interface CompactionPlan {
  head: TanzoUIMessage[]
  tail: TanzoUIMessage[]
  archivedIds: string[]
  sourceMessages: ModelMessage[]
}

export interface CompactionResult {
  summary: TanzoUIMessage
  archivedIds: string[]
  beforeTokens?: number
  afterTokens?: number
  next: TanzoUIMessage[]
}

export function splitForCompaction(
  messages: TanzoUIMessage[],
  retainedRecentSteps: number
): Partition {
  return partitionAtCut(messages, findCut(messages, retainedRecentSteps))
}

export async function planCompaction(
  messages: TanzoUIMessage[],
  retainedRecentSteps: number
): Promise<CompactionPlan | null> {
  const { head, tail, archivedIds } = splitForCompaction(messages, retainedRecentSteps)
  if (head.length === 0) return null
  if (head.every(isSummaryMessage)) return null

  const sourceMessages = canonicalizeToolTranscript(
    await convertToModelMessages(head, { ignoreIncompleteToolCalls: true })
  )

  return { head, tail, archivedIds, sourceMessages }
}

function buildSummary(input: {
  summaryText: string
  summaryId?: string
  auto: boolean
  beforeTokens?: number
  afterTokens?: number
  usage?: TanzoUsageMetadata
  omittedMessages: number
}): TanzoUIMessage {
  const reducedTokens =
    input.beforeTokens !== undefined && input.afterTokens !== undefined
      ? Math.max(input.beforeTokens - input.afterTokens, 0)
      : undefined
  const summaryId = input.summaryId ?? randomUUID()
  const compaction: TanzoDataParts['compaction'] = {
    stage: 'complete',
    auto: input.auto,
    summary: input.summaryText,
    summaryId,
    ...(input.beforeTokens !== undefined ? { beforeTokens: input.beforeTokens } : {}),
    ...(input.afterTokens !== undefined ? { afterTokens: input.afterTokens } : {}),
    ...(input.usage ? { usage: input.usage } : {}),
    ...(reducedTokens !== undefined ? { reducedTokens } : {}),
    omittedMessages: input.omittedMessages
  }
  return {
    id: summaryId,
    role: 'assistant',
    parts: [
      { type: 'text', text: input.summaryText },
      { type: 'data-compaction', data: compaction }
    ]
  }
}

export function buildCompactionResult(input: {
  plan: CompactionPlan
  summaryText: string
  summaryId?: string
  auto: boolean
  usage?: TanzoUsageMetadata
}): CompactionResult {
  const summaryText = stripAnalysis(input.summaryText)
  if (!summaryText) throw new Error('Compaction produced an empty summary')

  const { plan, usage } = input
  const beforeTokens = usage?.inputTokens
  const afterTokens = usage?.outputTokens
  const summary = buildSummary({
    summaryText,
    ...(input.summaryId ? { summaryId: input.summaryId } : {}),
    auto: input.auto,
    ...(beforeTokens !== undefined ? { beforeTokens } : {}),
    ...(afterTokens !== undefined ? { afterTokens } : {}),
    ...(usage ? { usage } : {}),
    omittedMessages: plan.head.length
  })

  return {
    summary,
    archivedIds: plan.archivedIds,
    ...(beforeTokens !== undefined ? { beforeTokens } : {}),
    ...(afterTokens !== undefined ? { afterTokens } : {}),
    next: [summary, ...plan.tail]
  }
}
