import {
  type PetApprovalRef,
  type PetPresencePayload,
  type PetPresenceState,
  type PetReplyRef
} from '@shared/pet'

const DONE_WINDOW_MS = 4000
const ERROR_WINDOW_MS = 5000
const REVIEW_WINDOW_MS = 6000
const STALE_CHAT_MS = 120_000
const REPLY_MAX_CHARS = 140

interface TelemetryLike {
  event?: string
}

interface TaskApprovalPayloadLike {
  rootChatId?: unknown
  approvals?: unknown
}

interface TaskApprovalViewLike {
  approval?: { approvalId?: unknown; toolName?: unknown }
}

interface NotificationChunkLike {
  type: string
  data?: unknown
}

export interface PresenceAggregator {
  observeChunk(chatId: string, chunk: NotificationChunkLike): void
  observeText(chatId: string, delta: string): void
  setActiveChatId(chatId: string | null): void
  snapshot(): PetPresencePayload
  dispose(): void
}

export interface PresenceAggregatorDeps {
  isAnyRunning: () => boolean
  broadcast: (payload: PetPresencePayload) => void
}

function readApproval(data: unknown): PetApprovalRef | null {
  if (typeof data !== 'object' || data === null) return null
  const payload = data as TaskApprovalPayloadLike
  if (typeof payload.rootChatId !== 'string' || !Array.isArray(payload.approvals)) return null
  const first = payload.approvals[0] as TaskApprovalViewLike | undefined
  const approvalId = first?.approval?.approvalId
  const toolName = first?.approval?.toolName
  if (typeof approvalId !== 'string' || typeof toolName !== 'string') return null
  return {
    rootChatId: payload.rootChatId,
    approvalId,
    toolName
  }
}

export function createPresenceAggregator(deps: PresenceAggregatorDeps): PresenceAggregator {
  const runningChats = new Set<string>()
  const toolCounts = new Map<string, number>()
  const lastActivity = new Map<string, number>()
  const approvals = new Map<string, PetApprovalRef>()
  const replyBuffers = new Map<string, string>()
  const timers = new Set<ReturnType<typeof setTimeout>>()

  let errorUntil = 0
  let doneUntil = 0
  let reviewUntil = 0
  let activeChatId: string | null = null
  let lastReply: PetReplyRef | null = null
  let lastSent: PetPresencePayload | null = null

  function currentApproval(): PetApprovalRef | null {
    for (const ref of approvals.values()) return ref
    return null
  }

  function totalTools(): number {
    let total = 0
    for (const count of toolCounts.values()) total += count
    return total
  }

  function reconcileStale(now: number): void {
    if (deps.isAnyRunning()) return
    for (const chatId of [...runningChats]) {
      if (now - (lastActivity.get(chatId) ?? 0) >= STALE_CHAT_MS) {
        runningChats.delete(chatId)
        toolCounts.delete(chatId)
        lastActivity.delete(chatId)
      }
    }
  }

  function deriveState(now: number): PetPresenceState {
    if (currentApproval()) return 'waiting-approval'
    if (now < errorUntil) return 'error'
    if (totalTools() > 0) return 'running-tool'
    if (runningChats.size > 0) return 'thinking'
    if (now < reviewUntil) return 'review'
    if (now < doneUntil) return 'done'
    if (deps.isAnyRunning()) return 'thinking'
    return 'idle'
  }

  function buildPayload(now: number): PetPresencePayload {
    const reply = lastReply && now < doneUntil ? lastReply : null
    return {
      state: deriveState(now),
      approval: currentApproval(),
      activeChatId,
      lastReply: reply
    }
  }

  function samePayload(a: PetPresencePayload, b: PetPresencePayload): boolean {
    return (
      a.state === b.state &&
      a.activeChatId === b.activeChatId &&
      (a.approval?.approvalId ?? null) === (b.approval?.approvalId ?? null) &&
      (a.lastReply?.at ?? null) === (b.lastReply?.at ?? null)
    )
  }

  function evaluate(): void {
    const now = Date.now()
    reconcileStale(now)
    const payload = buildPayload(now)
    if (lastSent && samePayload(lastSent, payload)) return
    lastSent = payload
    deps.broadcast(payload)
  }

  function schedule(delayMs: number): void {
    const timer = setTimeout(() => {
      timers.delete(timer)
      evaluate()
    }, delayMs)
    if (typeof timer.unref === 'function') timer.unref()
    timers.add(timer)
  }

  function clearApprovalsFor(chatId: string): void {
    approvals.delete(chatId)
  }

  function clearTransientWindows(): void {
    errorUntil = 0
    doneUntil = 0
    reviewUntil = 0
  }

  function observeTelemetry(chatId: string, data: TelemetryLike): void {
    lastActivity.set(chatId, Date.now())
    const event = data.event
    switch (event) {
      case 'operation-start':
        clearTransientWindows()
        runningChats.add(chatId)
        toolCounts.set(chatId, 0)
        replyBuffers.set(chatId, '')
        break
      case 'model-call-start':
      case 'step-start':
        clearTransientWindows()
        runningChats.add(chatId)
        clearApprovalsFor(chatId)
        break
      case 'tool-start':
        clearTransientWindows()
        runningChats.add(chatId)
        toolCounts.set(chatId, (toolCounts.get(chatId) ?? 0) + 1)
        clearApprovalsFor(chatId)
        break
      case 'tool-finish':
        toolCounts.set(chatId, Math.max(0, (toolCounts.get(chatId) ?? 0) - 1))
        break
      case 'operation-error':
      case 'retry-exhausted':
        runningChats.delete(chatId)
        toolCounts.delete(chatId)
        lastActivity.delete(chatId)
        clearApprovalsFor(chatId)
        doneUntil = 0
        reviewUntil = 0
        errorUntil = Date.now() + ERROR_WINDOW_MS
        schedule(ERROR_WINDOW_MS)
        break
      case 'operation-finish': {
        runningChats.delete(chatId)
        toolCounts.delete(chatId)
        lastActivity.delete(chatId)
        clearApprovalsFor(chatId)
        const reply = (replyBuffers.get(chatId) ?? '').trim()
        replyBuffers.delete(chatId)
        if (runningChats.size === 0) {
          if (reply) lastReply = { text: clipReply(reply), chatId, at: Date.now() }
          doneUntil = Date.now() + DONE_WINDOW_MS
          schedule(DONE_WINDOW_MS)
        }
        break
      }
      default:
        break
    }
  }

  return {
    observeChunk(chatId, chunk) {
      switch (chunk.type) {
        case 'data-telemetry':
          activeChatId = chatId
          if (chunk.data && typeof chunk.data === 'object') {
            observeTelemetry(chatId, chunk.data as TelemetryLike)
          }
          break
        case 'data-taskApproval': {
          activeChatId = chatId
          const payload = chunk.data as { rootChatId?: string; approvals?: unknown[] } | undefined
          const ref = readApproval(chunk.data)
          if (ref) {
            clearTransientWindows()
            approvals.set(ref.rootChatId, ref)
          } else if (payload && typeof payload.rootChatId === 'string') {
            approvals.delete(payload.rootChatId)
          }
          break
        }
        case 'data-changePreview':
          activeChatId = chatId
          doneUntil = 0
          reviewUntil = Date.now() + REVIEW_WINDOW_MS
          schedule(REVIEW_WINDOW_MS)
          break
        default:
          return
      }
      evaluate()
    },
    observeText(chatId, delta) {
      if (!delta) return
      replyBuffers.set(chatId, (replyBuffers.get(chatId) ?? '') + delta)
    },
    setActiveChatId(chatId) {
      activeChatId = chatId
      evaluate()
    },
    snapshot() {
      return buildPayload(Date.now())
    },
    dispose() {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      runningChats.clear()
      toolCounts.clear()
      lastActivity.clear()
      approvals.clear()
      replyBuffers.clear()
    }
  }
}

function clipReply(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > REPLY_MAX_CHARS
    ? collapsed.slice(0, REPLY_MAX_CHARS).trimEnd() + '…'
    : collapsed
}
