import { z } from 'zod'
import type { HookEvent } from '@shared/hooks'
import type { HookExecResult, HookOutputEntry } from './types'

const universalSchema = z.object({
  continue: z.boolean().optional(),
  stopReason: z.string().optional(),
  suppressOutput: z.boolean().optional(),
  systemMessage: z.string().optional()
})

const preToolUseSchema = universalSchema
  .extend({
    decision: z.enum(['approve', 'block']).optional(),
    reason: z.string().optional(),
    hookSpecificOutput: z
      .object({
        hookEventName: z.literal('PreToolUse'),
        permissionDecision: z.enum(['allow', 'deny', 'ask']).optional(),
        permissionDecisionReason: z.string().optional(),
        updatedInput: z.unknown().optional(),
        additionalContext: z.string().optional()
      })
      .strict()
      .optional()
  })
  .strict()

const postToolUseSchema = universalSchema
  .extend({
    decision: z.literal('block').optional(),
    reason: z.string().optional(),
    hookSpecificOutput: z
      .object({
        hookEventName: z.literal('PostToolUse'),
        additionalContext: z.string().optional(),
        updatedMCPToolOutput: z.unknown().optional()
      })
      .strict()
      .optional()
  })
  .strict()

const userPromptSubmitSchema = universalSchema
  .extend({
    decision: z.literal('block').optional(),
    reason: z.string().optional(),
    hookSpecificOutput: z
      .object({
        hookEventName: z.literal('UserPromptSubmit'),
        additionalContext: z.string().optional()
      })
      .strict()
      .optional()
  })
  .strict()

const sessionStartSchema = universalSchema
  .extend({
    hookSpecificOutput: z
      .object({
        hookEventName: z.literal('SessionStart'),
        additionalContext: z.string().optional()
      })
      .strict()
      .optional()
  })
  .strict()

const stopSchema = universalSchema
  .extend({
    decision: z.literal('block').optional(),
    reason: z.string().optional()
  })
  .strict()

const SCHEMAS = {
  PreToolUse: preToolUseSchema,
  PostToolUse: postToolUseSchema,
  UserPromptSubmit: userPromptSubmitSchema,
  SessionStart: sessionStartSchema,
  Stop: stopSchema
} as const

type SupportedEvent = keyof typeof SCHEMAS

const TEXT_AS_CONTEXT: Record<SupportedEvent, boolean> = {
  PreToolUse: false,
  PostToolUse: false,
  UserPromptSubmit: true,
  SessionStart: true,
  Stop: false
}

export interface HandlerOutcome {
  denied: boolean
  denyReason?: string
  stopped: boolean
  stopReason?: string
  feedback?: string
  additionalContext?: string
  updatedInput?: unknown
  hasUpdatedInput: boolean
  entries: HookOutputEntry[]
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function empty(): HandlerOutcome {
  return { denied: false, stopped: false, hasUpdatedInput: false, entries: [] }
}

export function parseHandlerResult(
  event: HookEvent,
  key: string,
  result: HookExecResult
): HandlerOutcome {
  const outcome = empty()
  const fail = (message: string): HandlerOutcome => {
    outcome.entries.push({ kind: 'error', message, key })
    return outcome
  }

  if (result.error) return fail(result.error)
  if (!(event in SCHEMAS)) {
    return outcome
  }
  const ev = event as SupportedEvent

  if (result.exitCode === 2) {
    const reason = result.stderr.trim()
    if (!reason) return fail(`hook exited with code 2 but wrote no stderr`)
    return applyStderrBlock(ev, reason, outcome)
  }

  if (result.exitCode !== 0) {
    return fail(
      result.exitCode === null
        ? 'hook exited without a status code'
        : `hook exited with code ${result.exitCode}`
    )
  }

  const stdout = result.stdout.trim()
  if (!stdout) return outcome

  let json: unknown
  try {
    json = JSON.parse(stdout)
  } catch {
    if (looksLikeJson(stdout)) return fail('hook produced invalid JSON output')
    if (TEXT_AS_CONTEXT[ev]) outcome.additionalContext = stdout
    return outcome
  }

  const parsed = SCHEMAS[ev].safeParse(json)
  if (!parsed.success) {
    return fail(`hook produced invalid ${ev} output: ${parsed.error.issues[0]?.message}`)
  }
  return applyJsonOutput(ev, parsed.data, outcome, key)
}

function applyStderrBlock(
  event: SupportedEvent,
  reason: string,
  outcome: HandlerOutcome
): HandlerOutcome {
  switch (event) {
    case 'PreToolUse':
    case 'UserPromptSubmit':
      outcome.denied = true
      outcome.denyReason = reason
      break
    case 'PostToolUse':
    case 'Stop':
      outcome.feedback = reason
      break
    case 'SessionStart':
      outcome.entries.push({ kind: 'error', message: reason, key: '' })
      break
  }
  return outcome
}

type ParsedOutput = z.infer<(typeof SCHEMAS)[SupportedEvent]>

function applyJsonOutput(
  event: SupportedEvent,
  data: ParsedOutput,
  outcome: HandlerOutcome,
  key: string
): HandlerOutcome {
  if (data.systemMessage) {
    outcome.entries.push({ kind: 'warning', message: data.systemMessage, key })
  }
  if (data.continue === false && event !== 'PreToolUse') {
    outcome.stopped = true
    if (data.stopReason) outcome.stopReason = data.stopReason
  }

  if (event === 'PreToolUse') {
    const d = data as z.infer<typeof preToolUseSchema>
    const hs = d.hookSpecificOutput
    const decision = hs?.permissionDecision
    if (decision === 'deny' || d.decision === 'block') {
      outcome.denied = true
      outcome.denyReason = hs?.permissionDecisionReason ?? d.reason ?? 'blocked by hook'
    }
    if (hs?.updatedInput !== undefined) {
      outcome.hasUpdatedInput = true
      outcome.updatedInput = hs.updatedInput
      outcome.entries.push({
        kind: 'warning',
        message: 'hook returned updatedInput, which is not yet supported — ignored',
        key
      })
    }
    if (hs?.additionalContext) outcome.additionalContext = hs.additionalContext
    return outcome
  }

  if (event === 'PostToolUse') {
    const d = data as z.infer<typeof postToolUseSchema>
    if (d.decision === 'block' && d.reason) outcome.feedback = d.reason
    if (d.hookSpecificOutput?.additionalContext) {
      outcome.additionalContext = d.hookSpecificOutput.additionalContext
    }
    if (d.hookSpecificOutput?.updatedMCPToolOutput !== undefined) {
      outcome.entries.push({
        kind: 'warning',
        message: 'hook returned updatedMCPToolOutput, which is not yet supported — ignored',
        key
      })
    }
    return outcome
  }

  if (event === 'UserPromptSubmit') {
    const d = data as z.infer<typeof userPromptSubmitSchema>
    if (d.decision === 'block') {
      outcome.denied = true
      outcome.denyReason = d.reason ?? 'prompt blocked by hook'
    }
    if (d.hookSpecificOutput?.additionalContext) {
      outcome.additionalContext = d.hookSpecificOutput.additionalContext
    }
    return outcome
  }

  if (event === 'SessionStart') {
    const d = data as z.infer<typeof sessionStartSchema>
    if (d.hookSpecificOutput?.additionalContext) {
      outcome.additionalContext = d.hookSpecificOutput.additionalContext
    }
    return outcome
  }

  const d = data as z.infer<typeof stopSchema>
  if (d.decision === 'block' && d.reason) outcome.feedback = d.reason
  return outcome
}
