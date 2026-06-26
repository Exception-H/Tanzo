import { randomUUID } from 'crypto'
import {
  convertToModelMessages,
  createUIMessageStream,
  streamText,
  toUIMessageStream,
  type ModelMessage,
  type ToolSet
} from 'ai'
import { getErrorMessage } from '@ai-sdk/provider'
import type { ChatRunError, ChatRunStatus } from '@shared/chat'
import { ERROR_CODES } from '@shared/errors'
import type {
  SubagentTraceEntry,
  TanzoMetadata,
  TanzoStepUsageMetadata,
  TanzoUIMessage,
  TanzoUsageMetadata
} from '@shared/agent-message'
import type { AgentDefinition } from '../agents/types'
import type { ContextEngine } from '../context'
import { getContextProvenance } from '../context/section'
import { canonicalizeToolTranscript } from '../context/tool-transcript'
import type { ChatKeyedQueue } from './chat-keyed-queue'
import { createAgentTelemetry } from '../telemetry'
import { createDbTelemetrySink } from '../telemetry/sinks'
import type { AgentRuntimeDeps, GoalRuntime, Logger } from './types'
import type { SkillsStore } from '../skills/types'
import { buildAgentCall } from './build-agent'
import { recordFinishedStepDiagnostic, recordPreparedStepDiagnostic } from './prompt-diagnostics'
import { toolKeyMatchesPattern } from '../tools/registry'

export type UsageLike = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }
  outputTokenDetails?: { reasoningTokens?: number }
  reasoningTokens?: number
  cachedInputTokens?: number
}

export interface AgentStreamRunnerDeps extends AgentRuntimeDeps {
  skills?: SkillsStore
  logger?: Logger
  contextEngine?: ContextEngine
  goal?: GoalRuntime
}

export interface AgentStreamFinalState {
  latestUsage?: UsageLike
  producedToolCall: boolean
  producedWorkToolCall: boolean
  streamFailed: boolean
  streamError?: string
  aborted: boolean
  turnStartedAt: number
  lastFinishReason?: string
  exceededCompactionTrigger: boolean
  hitCompactionTrigger: boolean
  isGoalContinuation: boolean
  exitPlanModeCalled: boolean
  endedWithTextOnly: boolean
}

export function streamStatus(state: AgentStreamFinalState): Exclude<ChatRunStatus, 'running'> {
  if (state.aborted) return 'aborted'
  if (state.streamFailed) return 'failed'
  return 'finished'
}

export function terminalRunError(state: AgentStreamFinalState): ChatRunError | undefined {
  if (!state.streamFailed) return undefined
  return {
    code: ERROR_CODES.CHAT_RUN_FAILED,
    message: state.streamError ?? 'The model stream failed.'
  }
}

interface StartAgentStreamInput {
  chatId: string
  def: AgentDefinition
  messages: TanzoUIMessage[]
  depth: number
  broadcast: boolean
  runId: string
  signal: AbortSignal
  steerQueue: ChatKeyedQueue<string>
  recordConsumedSteering?: (messages: TanzoUIMessage[]) => void
  persistStepMessages?: (
    messages: TanzoUIMessage[],
    usage: UsageLike | undefined
  ) => Promise<boolean> | boolean | void
  persistFinalMessages?: (
    messages: TanzoUIMessage[],
    state: { streamFailed: boolean }
  ) => Promise<boolean> | boolean | void
  onTrace?: (entry: SubagentTraceEntry) => void
  onFinally: (state: AgentStreamFinalState) => Promise<void> | void
  isGoalContinuation?: boolean
  forceExitPlanMode?: boolean
}

function usageMetadata(usage: UsageLike | undefined): TanzoUsageMetadata | undefined {
  if (!usage) return undefined
  const normalized: TanzoUsageMetadata = {
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    ...(usage.totalTokens !== undefined ? { totalTokens: usage.totalTokens } : {}),
    ...(usage.outputTokenDetails?.reasoningTokens !== undefined
      ? { reasoningTokens: usage.outputTokenDetails.reasoningTokens }
      : usage.reasoningTokens !== undefined
        ? { reasoningTokens: usage.reasoningTokens }
        : {}),
    ...(usage.inputTokenDetails?.cacheReadTokens !== undefined
      ? { cacheReadTokens: usage.inputTokenDetails.cacheReadTokens }
      : usage.cachedInputTokens !== undefined
        ? { cacheReadTokens: usage.cachedInputTokens }
        : {}),
    ...(usage.inputTokenDetails?.cacheWriteTokens !== undefined
      ? { cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens }
      : {})
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function stepUsageMetadata(
  stepNumber: number,
  part: {
    usage?: UsageLike
    finishReason?: string
    providerMetadata?: Record<string, unknown>
  }
): TanzoStepUsageMetadata {
  return {
    stepNumber,
    usage: usageMetadata(part.usage) ?? null,
    finishReason: part.finishReason ?? null,
    providerMetadata: part.providerMetadata ?? null
  }
}

function messageUsageMetadata(input: {
  steps: TanzoStepUsageMetadata[]
  usage?: TanzoUsageMetadata
}): TanzoMetadata | undefined {
  const metadata: TanzoMetadata = {}
  if (input.steps.length > 0) metadata.steps = [...input.steps]
  if (input.usage) metadata.usage = input.usage
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function readSkillAllowedTools(output: unknown): string[] {
  if (typeof output !== 'object' || output === null) return []
  const record = output as { allowedTools?: unknown; error?: unknown }
  if (record.error === true || !Array.isArray(record.allowedTools)) return []
  return record.allowedTools.filter(
    (tool): tool is string => typeof tool === 'string' && tool.length > 0
  )
}

function collectSkillToolPatterns(messages: ModelMessage[]): string[] {
  const patterns = new Set<string>()
  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      if ((part as { type?: string }).type !== 'tool-result') continue
      const result = part as {
        toolName?: string
        output?: { type?: string; value?: unknown }
      }
      if (result.toolName !== 'skill' || result.output?.type !== 'json') continue
      for (const pattern of readSkillAllowedTools(result.output.value)) patterns.add(pattern)
    }
  }
  return [...patterns]
}

function resolveActiveTools(patterns: string[], tools: ToolSet): string[] {
  if (patterns.length === 0) return []
  return Object.keys(tools).filter((key) =>
    patterns.some((pattern) => toolKeyMatchesPattern(key, pattern))
  )
}

function skillActiveTools(messages: ModelMessage[], tools: ToolSet): string[] | undefined {
  const activeTools = resolveActiveTools(collectSkillToolPatterns(messages), tools)
  return activeTools.length > 0 ? activeTools : undefined
}

function isUsageLimitError(error: unknown): boolean {
  const record = error as { statusCode?: unknown; status?: unknown; message?: unknown } | null
  if (record?.statusCode === 429 || record?.status === 429) return true
  const message = typeof record?.message === 'string' ? record.message.toLowerCase() : ''
  return /rate limit|quota|usage limit|too many requests/.test(message)
}

const OVERHEAD_TOOL_NAMES = new Set(['updateGoal', 'todo'])

function toolKind(tools: ToolSet, toolName: string): string | undefined {
  const tool = tools[toolName] as { metadata?: { tanzo?: { kind?: unknown } } } | undefined
  const kind = tool?.metadata?.tanzo?.kind
  return typeof kind === 'string' ? kind : undefined
}

function isWorkToolCall(tools: ToolSet, toolName: string): boolean {
  if (OVERHEAD_TOOL_NAMES.has(toolName)) return false
  const kind = toolKind(tools, toolName)
  return kind === 'edit' || kind === 'exec'
}

export function startAgentStream(
  deps: AgentStreamRunnerDeps,
  opts: StartAgentStreamInput
): {
  stream: AsyncIterable<unknown>
} {
  let latestUsage: UsageLike | undefined
  let turnUsage: UsageLike | undefined
  let streamFailed = false
  let streamError: string | undefined
  let producedToolCall = false
  let producedWorkToolCall = false
  let exitPlanModeCalled = false
  let lastStepHadToolCall = false
  let lastFinishReason: string | undefined
  let hookRequestedStop = false
  const turnStartedAt = Date.now()
  const telemetry = createAgentTelemetry({
    runId: opts.runId,
    chatId: opts.chatId,
    scope: 'chat',
    send: deps.send,
    broadcast: opts.broadcast,
    sinks: [
      createDbTelemetrySink({ store: deps.store, ...(deps.logger ? { logger: deps.logger } : {}) })
    ],
    ...(deps.logger ? { logger: deps.logger } : {})
  })

  const stream = createUIMessageStream<TanzoUIMessage>({
    originalMessages: opts.messages,
    execute: async ({ writer }) => {
      let stepCounter = 0
      const aggregatedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      const stepUsages: TanzoStepUsageMetadata[] = []
      const consumedSteering: ModelMessage[] = []
      const rootChatId = deps.store.rootOf(opts.chatId)
      const mode = deps.policy.getMode(rootChatId)
      const cwd = deps.store.getConversation(opts.chatId)?.cwd ?? process.cwd()
      const tools = await deps.buildTools({
        def: opts.def,
        chatId: opts.chatId,
        depth: opts.depth,
        mode,
        messages: opts.messages
      })
      const compactionTriggerTokens = deps.contextEngine?.compactionTriggerTokens(opts.def)
      const agentCall = buildAgentCall({
        def: opts.def,
        chatId: opts.chatId,
        mode,
        providerService: deps.providerService,
        tools,
        decide: deps.policy.decide,
        shouldStop: () => hookRequestedStop,
        ...(compactionTriggerTokens !== undefined ? { compactionTriggerTokens } : {}),
        telemetry: telemetry.options,
        ...(opts.forceExitPlanMode
          ? { toolChoice: { type: 'tool' as const, toolName: 'exitPlanMode' } }
          : {})
      })

      const initialMessages = canonicalizeToolTranscript(
        await convertToModelMessages(opts.messages, { tools, ignoreIncompleteToolCalls: true })
      )

      const result = streamText<ToolSet>({
        model: agentCall.model,
        tools: agentCall.tools,
        runtimeContext: agentCall.runtimeContext,
        toolApproval: agentCall.toolApproval,
        stopWhen: agentCall.stopWhen,
        ...agentCall.callSettings,
        ...(agentCall.providerOptions ? { providerOptions: agentCall.providerOptions } : {}),
        ...(agentCall.telemetry ? { telemetry: agentCall.telemetry } : {}),
        ...(agentCall.toolChoice ? { toolChoice: agentCall.toolChoice } : {}),
        messages: initialMessages,
        abortSignal: opts.signal,
        prepareStep: async ({ responseMessages, stepNumber }) => {
          const steers = opts.steerQueue.drain(opts.chatId)
          if (steers.length > 0) {
            opts.recordConsumedSteering?.(
              steers.map<TanzoUIMessage>((text) => ({
                id: randomUUID(),
                role: 'user',
                parts: [{ type: 'text', text }]
              }))
            )
            for (const text of steers) consumedSteering.push({ role: 'user', content: text })
          }
          const base = canonicalizeToolTranscript([
            ...initialMessages,
            ...(responseMessages as ModelMessage[])
          ])
          const transcript = consumedSteering.length > 0 ? [...base, ...consumedSteering] : base
          const built = await deps.contextEngine?.build(
            opts.def,
            opts.chatId,
            cwd,
            transcript,
            stepNumber,
            { consumeGoalInjection: true }
          )
          if (!built) return undefined
          const messages = canonicalizeToolTranscript(built.messages as ModelMessage[])
          const activeTools = skillActiveTools(messages, tools)
          const provenance = getContextProvenance(built)
          recordPreparedStepDiagnostic(deps, {
            chatId: opts.chatId,
            runId: opts.runId,
            stepNumber: stepNumber + 1,
            def: opts.def,
            tools,
            prepared: {
              system: built.instructions as never,
              messages: built.messages as never,
              providerOptions: built.providerOptions as Record<string, unknown> | undefined,
              ...(provenance ? { provenance } : {})
            }
          })
          return {
            instructions: built.instructions,
            messages,
            ...(activeTools ? { activeTools } : {}),
            ...(built.providerOptions ? { providerOptions: built.providerOptions } : {})
          }
        },
        onStepEnd: async (step) => {
          latestUsage = step.usage
          lastFinishReason = step.finishReason
          stepCounter += 1
          recordFinishedStepDiagnostic(deps, {
            chatId: opts.chatId,
            runId: opts.runId,
            stepNumber: stepCounter,
            usage: step.usage,
            finishReason: step.finishReason,
            providerMetadata: step.providerMetadata
          })
          lastStepHadToolCall = step.toolCalls.length > 0
          if (step.toolCalls.length > 0) {
            producedToolCall = true
            if (step.toolCalls.some((call) => isWorkToolCall(tools, call.toolName))) {
              producedWorkToolCall = true
            }
            if (step.toolCalls.some((call) => call.toolName === 'exitPlanMode')) {
              exitPlanModeCalled = true
            }
          }
          if (deps.hooks && step.toolResults.length > 0) {
            for (const toolResult of step.toolResults) {
              const outcome = await deps.hooks
                .runPostToolUse({
                  chatId: opts.chatId,
                  toolName: toolResult.toolName,
                  toolInput: toolResult.input,
                  toolResponse: toolResult.output,
                  toolUseId: toolResult.toolCallId
                })
                .catch((error): { stopped: boolean; stopReason?: string } => {
                  deps.logger?.warn('PostToolUse hook failed', { chatId: opts.chatId, error })
                  return { stopped: false }
                })
              if (outcome.stopped) {
                hookRequestedStop = true
                if (outcome.stopReason) {
                  deps.logger?.info('PostToolUse hook stopped turn', {
                    chatId: opts.chatId,
                    reason: outcome.stopReason
                  })
                }
              }
            }
          }
          if (opts.onTrace) {
            const text = step.text.trim()
            if (text) opts.onTrace({ type: 'text', text })
            for (const call of step.toolCalls) {
              opts.onTrace({ type: 'tool', toolName: call.toolName })
            }
          }
        }
      })

      writer.merge(
        toUIMessageStream<ToolSet, TanzoUIMessage>({
          stream: result.stream,
          onError: getErrorMessage,
          messageMetadata: ({ part }) => {
            if (part.type === 'finish-step') {
              stepUsages.push(stepUsageMetadata(stepUsages.length + 1, part))
              return messageUsageMetadata({ steps: stepUsages })
            }
            if (part.type !== 'finish') return undefined
            const usage = part.totalUsage
            aggregatedUsage.inputTokens += usage?.inputTokens ?? 0
            aggregatedUsage.outputTokens += usage?.outputTokens ?? 0
            aggregatedUsage.totalTokens += usage?.totalTokens ?? 0
            turnUsage = { ...aggregatedUsage }
            return messageUsageMetadata({
              steps: stepUsages,
              usage: usageMetadata(turnUsage)
            })
          }
        })
      )
    },
    onStepEnd: async ({ messages }) => {
      await opts.persistStepMessages?.(messages, latestUsage)
    },
    onEnd: async ({ messages }) => {
      await opts.persistFinalMessages?.(messages, { streamFailed })
    },
    onError: (error) => {
      streamFailed = true
      const message = getErrorMessage(error)
      streamError = message
      const event = telemetry.emitError(error)
      deps.logger?.warn('chat stream failed', { chatId: opts.chatId, error: event.error })
      if (opts.broadcast && isUsageLimitError(error)) deps.goal?.markUsageLimited(opts.chatId)
      return message
    }
  })

  const drain = async function* (): AsyncIterable<unknown> {
    try {
      for await (const chunk of stream) {
        if (opts.broadcast) deps.send(opts.chatId, chunk, { runId: opts.runId })
        yield chunk
      }
    } finally {
      const compactionTriggerTokens = deps.contextEngine?.compactionTriggerTokens(opts.def)
      const aborted = opts.signal.aborted
      const exceededCompactionTrigger =
        !aborted &&
        !streamFailed &&
        compactionTriggerTokens !== undefined &&
        (latestUsage?.inputTokens ?? 0) > compactionTriggerTokens
      const hitCompactionTrigger = exceededCompactionTrigger && lastStepHadToolCall
      const finalUsage = turnUsage ?? latestUsage
      await opts.onFinally({
        ...(finalUsage ? { latestUsage: finalUsage } : {}),
        producedToolCall,
        producedWorkToolCall,
        streamFailed,
        ...(streamError ? { streamError } : {}),
        aborted,
        turnStartedAt,
        ...(lastFinishReason ? { lastFinishReason } : {}),
        exceededCompactionTrigger,
        hitCompactionTrigger,
        isGoalContinuation: opts.isGoalContinuation ?? false,
        exitPlanModeCalled,
        endedWithTextOnly: !aborted && !streamFailed && !lastStepHadToolCall
      })
    }
  }

  return { stream: drain() }
}
