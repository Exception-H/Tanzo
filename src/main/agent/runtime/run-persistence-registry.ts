import { convertToModelMessages } from 'ai'
import type { TanzoUIMessage } from '@shared/agent-message'
import type { AgentDefinition } from '../agents/types'
import type { ContextEngine } from '../context'
import { canonicalizeToolTranscript } from '../context/tool-transcript'
import type { AgentStore } from '../store-types'
import type { ChunkSink, Logger } from './types'

export type RunUsageLike = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }
  outputTokenDetails?: { reasoningTokens?: number }
  reasoningTokens?: number
  cachedInputTokens?: number
}

export interface ChatRunPersistenceContext {
  def: AgentDefinition
  broadcast: boolean
  canPersist(): boolean
  canPersistFinal?(): boolean
  store: Pick<AgentStore, 'save' | 'loadUnvalidated'>
  send: ChunkSink
  contextEngine?: Pick<ContextEngine, 'observeStep' | 'snapshot'>
  logger?: Pick<Logger, 'warn'>
}

interface RunPersistenceSession {
  chatId: string
  runId: string
  baseMessages: TanzoUIMessage[]
  consumedSteerMessages: TanzoUIMessage[]
  context: ChatRunPersistenceContext
}

export interface ChatRunPersistenceRegistry {
  start(
    chatId: string,
    runId: string,
    baseMessages: TanzoUIMessage[],
    context: ChatRunPersistenceContext
  ): void
  addConsumedSteering(chatId: string, runId: string, messages: TanzoUIMessage[]): void
  persistStepMessages(
    chatId: string,
    runId: string,
    messages: TanzoUIMessage[],
    usage?: RunUsageLike
  ): Promise<boolean>
  persistFinalMessages(
    chatId: string,
    runId: string,
    messages: TanzoUIMessage[],
    options: { streamFailed: boolean }
  ): Promise<boolean>
  finish(chatId: string, runId: string): void
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function continuationMessageId(session: RunPersistenceSession): string | undefined {
  const lastBase = session.baseMessages.at(-1)
  return lastBase?.role === 'assistant' ? lastBase.id : undefined
}

function mergeGeneratedMessages(
  session: RunPersistenceSession,
  current: readonly TanzoUIMessage[],
  incoming: readonly TanzoUIMessage[]
): TanzoUIMessage[] {
  const continuationId = continuationMessageId(session)
  const baseIds = new Set(session.baseMessages.map((message) => message.id))
  const isGenerated = (message: TanzoUIMessage): boolean =>
    !baseIds.has(message.id) || message.id === continuationId
  const generatedById = new Map(
    incoming.filter(isGenerated).map((message) => [message.id, message])
  )
  const currentIds = new Set(current.map((message) => message.id))
  const result = current.map((message) => generatedById.get(message.id) ?? message)

  for (const message of incoming) {
    if (!isGenerated(message) || currentIds.has(message.id)) continue
    const incomingIndex = incoming.indexOf(message)
    let anchorAt = result.length
    for (let j = incomingIndex + 1; j < incoming.length; j += 1) {
      const at = result.findIndex((existing) => existing.id === incoming[j].id)
      if (at !== -1) {
        anchorAt = at
        break
      }
    }
    result.splice(anchorAt, 0, message)
    currentIds.add(message.id)
  }
  return result
}

function persistableMessages(messages: TanzoUIMessage[]): TanzoUIMessage[] {
  return messages.filter((message) => message.parts.length > 0)
}

function withConsumedSteering(
  session: RunPersistenceSession,
  messages: TanzoUIMessage[]
): TanzoUIMessage[] {
  if (session.consumedSteerMessages.length === 0) return messages
  const existingIds = new Set(messages.map((message) => message.id))
  const missingSteers = session.consumedSteerMessages.filter(
    (message) => !existingIds.has(message.id)
  )
  if (missingSteers.length === 0) return messages
  const continuationId = continuationMessageId(session)
  const originalIds = new Set(
    session.baseMessages.map((message) => message.id).filter((id) => id !== continuationId)
  )
  let insertAt = 0
  while (insertAt < messages.length && originalIds.has(messages[insertAt].id)) insertAt += 1
  return [...messages.slice(0, insertAt), ...missingSteers, ...messages.slice(insertAt)]
}

async function publishContextSnapshot(
  session: RunPersistenceSession,
  messages: TanzoUIMessage[]
): Promise<void> {
  const { context } = session
  if (!context.broadcast || !context.contextEngine) return
  try {
    const modelMessages = canonicalizeToolTranscript(
      await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true })
    )
    context.send(
      session.chatId,
      {
        type: 'data-context',
        id: `context:${session.chatId}`,
        data: context.contextEngine.snapshot(context.def, session.chatId, modelMessages),
        transient: true
      },
      { runId: session.runId }
    )
  } catch (error) {
    context.logger?.warn('context snapshot publish failed', { chatId: session.chatId, error })
  }
}

async function persistRunMessages(
  session: RunPersistenceSession,
  messages: TanzoUIMessage[],
  options: {
    streamFailed?: boolean
    allowAfterFailure?: boolean
    isFinal?: boolean
    observeUsage?: boolean
    publishContext?: boolean
    usage?: RunUsageLike
  } = {}
): Promise<boolean> {
  const { context } = session
  if (options.streamFailed && !options.allowAfterFailure) return false
  const allowed = options.isFinal
    ? (context.canPersistFinal ?? context.canPersist)()
    : context.canPersist()
  if (!allowed) return false
  const incoming = persistableMessages(withConsumedSteering(session, messages))
  if (incoming.length === 0) return false
  const current = context.store.loadUnvalidated(session.chatId)
  const persisted = mergeGeneratedMessages(session, current, incoming)
  context.store.save(session.chatId, persisted)
  if (options.observeUsage && options.usage?.inputTokens) {
    context.contextEngine?.observeStep(session.chatId, persisted.length, options.usage as never)
  }
  if (options.publishContext) await publishContextSnapshot(session, persisted)
  return true
}

export function createChatRunPersistenceRegistry(): ChatRunPersistenceRegistry {
  const sessions = new Map<string, RunPersistenceSession>()

  const matchingSession = (chatId: string, runId: string): RunPersistenceSession | null => {
    const session = sessions.get(chatId)
    if (!session || session.runId !== runId) return null
    return session
  }

  return {
    start(chatId, runId, baseMessages, context) {
      sessions.set(chatId, {
        chatId,
        runId,
        baseMessages: clone(baseMessages),
        consumedSteerMessages: [],
        context
      })
    },

    addConsumedSteering(chatId, runId, messages) {
      const session = matchingSession(chatId, runId)
      if (!session) return
      session.consumedSteerMessages.push(...clone(messages))
    },

    persistStepMessages(chatId, runId, messages, usage) {
      const session = matchingSession(chatId, runId)
      if (!session) return Promise.resolve(false)
      return persistRunMessages(session, messages, {
        observeUsage: true,
        publishContext: true,
        ...(usage ? { usage } : {})
      })
    },

    persistFinalMessages(chatId, runId, messages, { streamFailed }) {
      const session = matchingSession(chatId, runId)
      if (!session) return Promise.resolve(false)
      return persistRunMessages(session, messages, {
        streamFailed,
        allowAfterFailure: true,
        isFinal: true,
        publishContext: !streamFailed
      })
    },

    finish(chatId, runId) {
      const session = sessions.get(chatId)
      if (session?.runId === runId) sessions.delete(chatId)
    }
  }
}
