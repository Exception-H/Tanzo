import { randomUUID } from 'crypto'
import type { ChatRunError, ChatRunStatus } from '@shared/chat'
import { ERROR_CODES } from '@shared/errors'
import type { SubagentTraceEntry, TanzoUIMessage } from '@shared/agent-message'
import type { AgentDefinition } from '../agents/types'
import type { ContextEngine } from '../context'
import type { ChangeSetService } from '../git/change-set-service'
import type { ChatKeyedQueue } from './chat-keyed-queue'
import type { CompactionCoordinator } from './compaction-coordinator'
import type { RunEngine } from './run-engine'
import type { ChatRunPersistenceRegistry } from './run-persistence-registry'
import type { ChatRunSessionRegistry } from './run-session-registry'
import { hasPendingApprovalRequest } from '@shared/approval-responses'
import { stripIncompleteInputToolParts } from './sanitize-messages'
import {
  startAgentStream,
  streamStatus,
  terminalRunError,
  type AgentStreamFinalState
} from './stream-runner'
import type { TurnFinalizer } from './turn-finalizer'
import {
  decideTurnOutcome,
  MAX_CONTINUATION_PASSES,
  MAX_PLAN_EXIT_PASSES,
  type TurnDecisionContext
} from './turn-loop.machine'
import type { AgentRuntimeDeps, GoalRuntime, Logger } from './types'

const PLAN_EXIT_NUDGE =
  'Plan mode is still active and you ended your turn with a text-only plan. A plan written in ' +
  'plain text is not a submitted plan — the user can only approve it through the exitPlanMode ' +
  'tool. If your plan is ready, call exitPlanMode now with the full plan as markdown. If a ' +
  'genuine decision still blocks the plan, call askQuestion instead. Do not reply with another ' +
  'text-only plan.'

export interface StartStreamInput {
  chatId: string
  def: AgentDefinition
  messages: TanzoUIMessage[]
  depth: number
  broadcast: boolean
  runId: string
  signal?: AbortSignal
  onTrace?: (entry: SubagentTraceEntry) => void
  isGoalContinuation?: boolean
  deferTerminal?: boolean
  forceExitPlanMode?: boolean
}

export type TurnLoopDeps = AgentRuntimeDeps & {
  logger?: Logger
  contextEngine?: ContextEngine
  goal?: GoalRuntime
  streams?: Pick<ChatRunSessionRegistry, 'start' | 'finish'>
  changeSet?: ChangeSetService
}

export interface TurnLoop {
  run(
    chatId: string,
    incoming: TanzoUIMessage[],
    options?: { isGoalContinuation?: boolean }
  ): Promise<void>
  startChatRun(
    opts: StartStreamInput & {
      onProgress?: () => void
      onStart?: (token: { epoch: number }) => void
    }
  ): Promise<AgentStreamFinalState>
  startGoalContinuation(chatId: string, scheduledGeneration?: number): Promise<void>
  /**
   * Abandon a change-set capture that a turn left pending while waiting for tool
   * approval. Called on cancel/delete so a deferred preview can never leak past
   * the turn it belongs to. No-op when nothing is pending for the chat.
   */
  discardPendingChangeCapture(chatId: string): void
}

export function createTurnLoop(
  deps: TurnLoopDeps,
  collaborators: {
    engine: RunEngine
    runPersistence: ChatRunPersistenceRegistry
    compaction: CompactionCoordinator
    turnFinalizer: TurnFinalizer
    steerQueue: ChatKeyedQueue<string>
  }
): TurnLoop {
  const { engine, runPersistence, compaction, turnFinalizer, steerQueue } = collaborators

  // Change-set capture is scoped to a logical turn, but a turn can span several
  // run() calls when it pauses for tool approval. Carry the in-progress capture
  // id across those pauses (keyed by chat) so the change preview is finalized
  // exactly once — when the turn truly ends — instead of prematurely surfacing
  // (and then duplicating) while an approval card is still pending.
  const pendingChangeCapture = new Map<string, string>()

  const isInflight = (chatId: string): boolean => engine.isRunning(chatId)

  function hasConversation(chatId: string): boolean {
    return Boolean(deps.store.getConversation(chatId))
  }

  function safeFinishStream(
    chatId: string,
    runId: string,
    status: Exclude<ChatRunStatus, 'running'>,
    error?: ChatRunError
  ): void {
    try {
      deps.streams?.finish(chatId, runId, status, error)
    } catch (finishError) {
      deps.logger?.warn('failed to finish run stream', { chatId, runId, error: finishError })
    }
  }

  function safeFinishPersistence(chatId: string, runId: string): void {
    try {
      runPersistence.finish(chatId, runId)
    } catch (error) {
      deps.logger?.warn('failed to finish run persistence', { chatId, runId, error })
    }
  }

  async function runTerminalDispatch(chatId: string, state: AgentStreamFinalState): Promise<void> {
    try {
      await turnFinalizer.dispatch({ chatId, broadcast: true, state })
    } catch (error) {
      deps.logger?.warn('turn dispatch failed', { chatId, error })
    }
  }

  function markRunOutcome(chatId: string, runId: string, state: AgentStreamFinalState): void {
    if (!hasConversation(chatId)) return
    try {
      const errorJson = state.streamFailed
        ? JSON.stringify({
            kind: 'stream-error',
            message: state.streamError ?? 'The model stream failed.'
          })
        : state.aborted
          ? JSON.stringify({ kind: 'aborted' })
          : undefined
      deps.store.markRunOutcome(
        chatId,
        runId,
        state.streamFailed ? 'failed' : 'finished',
        errorJson
      )
    } catch (error) {
      deps.logger?.warn('failed to mark run outcome', { chatId, error })
    }
  }

  function startChatRun(
    opts: StartStreamInput & {
      onProgress?: () => void
      onStart?: (token: { epoch: number }) => void
    }
  ): Promise<AgentStreamFinalState> {
    return engine.run<AgentStreamFinalState>(
      {
        chatId: opts.chatId,
        runId: opts.runId,
        kind: 'chat',
        baseMessages: opts.messages,
        ...(opts.signal ? { parentSignal: opts.signal } : {}),
        ...(opts.deferTerminal ? { deferTerminal: true } : {}),
        ...(opts.onStart ? { onStart: (handle) => opts.onStart?.({ epoch: handle.epoch }) } : {}),
        resolveTerminal: (state) => ({
          status: streamStatus(state),
          ...(terminalRunError(state) ? { error: terminalRunError(state) } : {})
        })
      },
      async (handle) => {
        runPersistence.start(opts.chatId, opts.runId, opts.messages, {
          def: opts.def,
          broadcast: opts.broadcast,
          canPersist: () =>
            !handle.signal.aborted && handle.isCurrent() && hasConversation(opts.chatId),
          canPersistFinal: () => handle.isCurrent() && hasConversation(opts.chatId),
          store: deps.store,
          send: deps.send,
          ...(deps.contextEngine ? { contextEngine: deps.contextEngine } : {}),
          ...(deps.logger ? { logger: deps.logger } : {})
        })

        let finalState!: AgentStreamFinalState
        const { stream } = startAgentStream(deps, {
          ...opts,
          signal: handle.signal,
          steerQueue,
          recordConsumedSteering: (messages) =>
            runPersistence.addConsumedSteering(opts.chatId, opts.runId, messages),
          persistStepMessages: (messages, usage) =>
            runPersistence.persistStepMessages(opts.chatId, opts.runId, messages, usage),
          persistFinalMessages: (messages, state) =>
            runPersistence.persistFinalMessages(opts.chatId, opts.runId, messages, state),
          onTrace: opts.onTrace
            ? (entry) => {
                opts.onTrace?.(entry)
                opts.onProgress?.()
              }
            : undefined,
          onFinally: async (state) => {
            finalState = state
            const wasOwner = handle.release()
            // Always reconcile steering on stream end. Terminal dispatch (queued
            // messages / goal continuation) is driven once by the run() loop for
            // deferred top-level turns, so intermediate compaction passes there
            // never dispatch. Non-deferred runs (sub-agent tasks) have no such
            // loop, so they dispatch per-run here — skipping compaction-trigger
            // passes, which continue rather than terminate.
            try {
              turnFinalizer.reconcile({ chatId: opts.chatId, wasOwner, state })
              if (!opts.deferTerminal && wasOwner && !state.hitCompactionTrigger) {
                await turnFinalizer.dispatch({
                  chatId: opts.chatId,
                  broadcast: opts.broadcast,
                  state
                })
              }
            } catch (error) {
              deps.logger?.warn('turn finalize failed', {
                chatId: opts.chatId,
                runId: opts.runId,
                error
              })
            }
            markRunOutcome(opts.chatId, opts.runId, state)
            safeFinishPersistence(opts.chatId, opts.runId)
          }
        })

        try {
          for await (const _chunk of stream) void _chunk
        } catch (error) {
          if (!finalState) {
            safeFinishPersistence(opts.chatId, opts.runId)
            throw error
          }
        }
        return finalState
      }
    )
  }

  async function run(
    chatId: string,
    incoming: TanzoUIMessage[],
    options: { isGoalContinuation?: boolean } = {}
  ): Promise<void> {
    const preparation = new AbortController()
    engine.setPreparing(chatId, preparation)
    let releaseActiveRun!: () => void
    engine.track(
      new Promise<void>((resolve) => {
        releaseActiveRun = resolve
      })
    )

    const endPreparation = (): void => {
      engine.clearPreparing(chatId, preparation)
    }
    const isPreparationCancelled = (): boolean => preparation.signal.aborted
    const stopIfPreparationCancelled = (): boolean => {
      if (!isPreparationCancelled()) return false
      endPreparation()
      return true
    }

    let messages = stripIncompleteInputToolParts(incoming)
    // Resume a capture carried over from an approval pause, or start a new one.
    // Resumed captures already have a before-checkpoint, so don't re-capture.
    const carriedChangeCapture = pendingChangeCapture.get(chatId)
    const changeSetRunId = carriedChangeCapture ?? randomUUID()
    const changeSetCwd = deps.store.getConversation(chatId)?.cwd
    let changeCaptureStarted = carriedChangeCapture !== undefined
    if (deps.changeSet && changeSetCwd && !carriedChangeCapture) {
      changeCaptureStarted = true
      await deps.changeSet
        .captureBeforeRun({
          runId: changeSetRunId,
          chatId,
          assistantMessageId: changeSetRunId,
          cwd: changeSetCwd
        })
        .catch((error) => {
          deps.logger?.warn('change-set captureBeforeRun failed', { chatId, error })
          changeCaptureStarted = false
        })
      if (stopIfPreparationCancelled()) {
        if (changeCaptureStarted) deps.changeSet?.discard(changeSetRunId)
        releaseActiveRun()
        return
      }
    }
    let pendingTerminal: {
      runId: string
      status: Exclude<ChatRunStatus, 'running'>
      error?: ChatRunError
    } | null = null
    let planExitPasses = 0
    let forceExitPlanMode = false
    let forceCompactionOnPrepare = false
    // Set only when the turn ends naturally with an unresolved approval request,
    // i.e. it will resume in a later run(). Any abort/failure/early-return leaves
    // this false so the capture is finalized (or discarded) like before.
    let turnAwaitingApproval = false
    try {
      for (let pass = 0; ; pass += 1) {
        if (stopIfPreparationCancelled()) return
        const runId = randomUUID()
        const def = await deps.store.resolveAgentDefinition(chatId)
        if (stopIfPreparationCancelled()) return
        if (messages.length > 0 && deps.store.getConversation(chatId)) {
          deps.store.save(chatId, messages)
        }
        if (stopIfPreparationCancelled()) return
        const shouldForceCompaction = forceCompactionOnPrepare
        forceCompactionOnPrepare = false
        const prepared = await compaction.prepareMessages(chatId, def, messages, runId, {
          force: shouldForceCompaction,
          signal: preparation.signal
        })
        if (stopIfPreparationCancelled()) return
        endPreparation()
        let state: AgentStreamFinalState
        try {
          state = await startChatRun({
            chatId,
            def,
            messages: prepared,
            depth: deps.store.depthOf(chatId),
            broadcast: true,
            runId,
            isGoalContinuation: options.isGoalContinuation ?? false,
            deferTerminal: true,
            ...(forceExitPlanMode ? { forceExitPlanMode: true } : {})
          })
        } catch (error) {
          pendingTerminal = {
            runId,
            status: 'failed',
            error: {
              code: ERROR_CODES.CHAT_RUN_FAILED,
              message: error instanceof Error ? error.message : String(error)
            }
          }
          throw error
        }
        const status = streamStatus(state)

        const decisionContext = (): TurnDecisionContext => ({
          pass,
          planExitPasses,
          isPlanMode: deps.policy.getMode(deps.store.rootOf(chatId)) === 'plan',
          isInflight: isInflight(chatId),
          hasConversation: Boolean(deps.store.getConversation(chatId))
        })
        let decision = decideTurnOutcome(state, decisionContext())

        if (decision.kind === 'plan-exit-retry' || decision.kind === 'compaction-retry') {
          const nextMessages = await deps.store.load(chatId)
          if (nextMessages.length > 0) {
            safeFinishStream(chatId, runId, status)
            if (decision.kind === 'plan-exit-retry') {
              planExitPasses += 1
              forceExitPlanMode = planExitPasses >= MAX_PLAN_EXIT_PASSES
              messages = [
                ...nextMessages,
                {
                  id: randomUUID(),
                  role: 'user',
                  parts: [{ type: 'text', text: PLAN_EXIT_NUDGE }]
                }
              ]
            } else {
              messages = nextMessages
              forceCompactionOnPrepare = true
            }
            engine.setPreparing(chatId, preparation)
            continue
          }
          // No messages to continue with: recompute the terminal action with
          // retries exhausted (post-compact or finalize).
          decision = decideTurnOutcome(state, {
            ...decisionContext(),
            pass: MAX_CONTINUATION_PASSES,
            planExitPasses: MAX_PLAN_EXIT_PASSES
          })
        }

        if (decision.kind === 'post-compact') {
          safeFinishStream(chatId, runId, status)
          try {
            await compaction.compactAfterRun(chatId, def, state, { signal: preparation.signal })
          } catch (error) {
            deps.logger?.warn('post-run compaction failed', { chatId, error })
          }
          await runTerminalDispatch(chatId, state)
          break
        }

        // A turn that stops to wait for tool approval is not actually over — it
        // resumes in a fresh run() once the user responds — so flag it to defer
        // the change preview instead of surfacing it under the approval card.
        turnAwaitingApproval =
          !state.aborted && !state.streamFailed && (await turnPausedForApproval(chatId))

        // Terminal turn: dispatch queued work / goal continuation exactly once.
        // Retry paths (plan-exit, compaction) `continue` above and never reach
        // here, so dispatch happens only when the turn is truly over.
        await runTerminalDispatch(chatId, state)

        pendingTerminal = {
          runId,
          status,
          ...(terminalRunError(state) ? { error: terminalRunError(state) } : {})
        }
        break
      }
    } finally {
      endPreparation()
      if (changeCaptureStarted && deps.changeSet && changeSetCwd) {
        // Deferred: keep the before-checkpoint alive for the resuming run(). A
        // cancel/delete clears it explicitly via discardPendingChangeCapture, so
        // a paused capture can never leak past the turn it belongs to.
        if (turnAwaitingApproval) {
          pendingChangeCapture.set(chatId, changeSetRunId)
        } else {
          pendingChangeCapture.delete(chatId)
          await finalizeChangeSet(chatId, changeSetRunId).catch((error) => {
            deps.logger?.warn('change-set captureAfterRun failed', { chatId, error })
            deps.changeSet?.discard(changeSetRunId)
          })
        }
      }
      if (pendingTerminal) {
        safeFinishStream(
          chatId,
          pendingTerminal.runId,
          pendingTerminal.status,
          pendingTerminal.error
        )
      }
      releaseActiveRun()
    }
  }

  async function turnPausedForApproval(chatId: string): Promise<boolean> {
    if (!deps.store.getConversation(chatId)) return false
    try {
      return hasPendingApprovalRequest(await deps.store.load(chatId))
    } catch (error) {
      deps.logger?.warn('failed to inspect pending approvals', { chatId, error })
      return false
    }
  }

  async function finalizeChangeSet(chatId: string, runId: string): Promise<void> {
    if (!deps.changeSet) return
    const cwd = deps.store.getConversation(chatId)?.cwd
    if (!cwd) {
      deps.changeSet.discard(runId)
      return
    }
    const messages = await deps.store.load(chatId)
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    const assistantMessageId = lastAssistant?.id ?? runId
    const preview = await deps.changeSet.captureAfterRun({
      runId,
      chatId,
      assistantMessageId,
      cwd
    })
    if (!preview || !lastAssistant) return
    const withPreview: TanzoUIMessage = {
      ...lastAssistant,
      parts: [
        ...lastAssistant.parts.filter(
          (part) => (part as { type?: string }).type !== 'data-changePreview'
        ),
        { type: 'data-changePreview', id: `changePreview:${runId}`, data: preview } as never
      ]
    }
    const nextMessages = messages.map((message) =>
      message.id === lastAssistant.id ? withPreview : message
    )
    deps.store.save(chatId, nextMessages)
    deps.send(chatId, {
      type: 'data-changePreview',
      id: `changePreview:${runId}`,
      data: preview,
      transient: true
    } as never)
  }

  async function startGoalContinuation(
    chatId: string,
    scheduledGeneration?: number
  ): Promise<void> {
    if (
      scheduledGeneration !== undefined &&
      engine.currentCancelGeneration(chatId) !== scheduledGeneration
    ) {
      return
    }
    if (isInflight(chatId)) return
    const goal = deps.goal?.get(chatId)
    if (!goal) return
    if (!deps.store.getConversation(chatId)) return
    let messages = await deps.store.load(chatId)
    if (messages.length === 0) {
      messages = [
        {
          id: randomUUID(),
          role: 'user',
          parts: [{ type: 'text', text: goal.objective }]
        }
      ]
    }
    await run(chatId, messages, { isGoalContinuation: true })
  }

  function discardPendingChangeCapture(chatId: string): void {
    const runId = pendingChangeCapture.get(chatId)
    if (runId === undefined) return
    pendingChangeCapture.delete(chatId)
    deps.changeSet?.discard(runId)
  }

  return { run, startChatRun, startGoalContinuation, discardPendingChangeCapture }
}
