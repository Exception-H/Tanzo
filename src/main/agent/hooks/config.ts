import { createHash } from 'node:crypto'
import { z } from 'zod'
import { HOOK_EVENTS, type HookEvent, type HookSource } from '@shared/hooks'
import type { HookEntry } from './types'

const PASCAL_TO_KEY: Record<HookEvent, string> = {
  PreToolUse: 'pre_tool_use',
  PermissionRequest: 'permission_request',
  PostToolUse: 'post_tool_use',
  PreCompact: 'pre_compact',
  PostCompact: 'post_compact',
  SessionStart: 'session_start',
  UserPromptSubmit: 'user_prompt_submit',
  SubagentStart: 'subagent_start',
  SubagentStop: 'subagent_stop',
  Stop: 'stop'
}

const commandHandlerSchema = z
  .object({
    type: z.literal('command'),
    command: z.string().min(1),
    commandWindows: z.string().min(1).optional(),
    timeout: z.number().positive().optional(),
    async: z.boolean().optional(),
    statusMessage: z.string().optional()
  })
  .strict()

const otherHandlerSchema = z.object({ type: z.enum(['prompt', 'agent']) }).loose()

const handlerSchema = z.union([commandHandlerSchema, otherHandlerSchema])

const matcherGroupSchema = z
  .object({
    matcher: z.string().optional(),
    hooks: z.array(handlerSchema).default([])
  })
  .strict()

const eventArraySchema = z.array(matcherGroupSchema).default([])

const hookEventsSchema = z
  .object(Object.fromEntries(HOOK_EVENTS.map((event) => [event, eventArraySchema])))
  .strict()

const hooksFileSchema = z.object({ hooks: hookEventsSchema.default({}) }).strict()

export interface ParseHooksResult {
  entries: HookEntry[]
  warnings: string[]
}

const EXACT_MATCHER_RE = /^[A-Za-z0-9_|]+$/

export function compileMatcher(
  matcher: string | null,
  warnings: string[],
  context: string
): (value: string) => boolean {
  if (matcher === null || matcher === '' || matcher === '*') return () => true
  if (EXACT_MATCHER_RE.test(matcher)) {
    const alternatives = new Set(matcher.split('|').filter((part) => part.length > 0))
    return (value) => alternatives.has(value)
  }
  try {
    const re = new RegExp(matcher)
    return (value) => re.test(value)
  } catch {
    warnings.push(`${context}: invalid matcher regex "${matcher}" — matches nothing`)
    return () => false
  }
}

export function hookContentHash(input: {
  command: string
  commandWindows?: string
  event: HookEvent
  matcher: string | null
}): string {
  const normalized = JSON.stringify({
    command: input.command,
    commandWindows: input.commandWindows ?? null,
    event: input.event,
    matcher: input.matcher ?? null
  })
  return createHash('sha256').update(normalized).digest('hex')
}

export function parseHooksConfig(input: {
  raw: unknown
  source: HookSource
  keySource: string
  configPath?: string
  displayOrderStart?: number
}): ParseHooksResult {
  const warnings: string[] = []
  const parsed = hooksFileSchema.safeParse(input.raw)
  if (!parsed.success) {
    warnings.push(`${input.keySource}: invalid hooks config — ${parsed.error.issues[0]?.message}`)
    return { entries: [], warnings }
  }

  const entries: HookEntry[] = []
  let order = input.displayOrderStart ?? 0

  for (const event of HOOK_EVENTS) {
    const groups = parsed.data.hooks[event] ?? []
    const eventLabel = PASCAL_TO_KEY[event]
    groups.forEach((group, groupIndex) => {
      const matcher = group.matcher ?? null
      const matches = compileMatcher(matcher, warnings, `${input.keySource}:${eventLabel}`)
      group.hooks.forEach((handler, handlerIndex) => {
        if (handler.type !== 'command') {
          warnings.push(
            `${input.keySource}:${eventLabel}:${groupIndex}:${handlerIndex}: ` +
              `"${handler.type}" handlers are not supported — skipped`
          )
          return
        }
        if (handler.async) {
          warnings.push(
            `${input.keySource}:${eventLabel}:${groupIndex}:${handlerIndex}: ` +
              `async hooks are not supported — skipped`
          )
          return
        }
        const key = `${input.keySource}:${eventLabel}:${groupIndex}:${handlerIndex}`
        entries.push({
          key,
          event,
          matcher,
          matches,
          command: handler.command,
          ...(handler.commandWindows ? { commandWindows: handler.commandWindows } : {}),
          timeoutSec: handler.timeout ?? 600,
          ...(handler.statusMessage ? { statusMessage: handler.statusMessage } : {}),
          source: input.source,
          ...(input.configPath ? { configPath: input.configPath } : {}),
          displayOrder: order++,
          contentHash: hookContentHash({
            command: handler.command,
            ...(handler.commandWindows ? { commandWindows: handler.commandWindows } : {}),
            event,
            matcher
          })
        })
      })
    })
  }

  return { entries, warnings }
}
