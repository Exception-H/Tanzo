import type { HookEvent } from '@shared/hooks'
import { parseHandlerResult } from './output-parser'
import type { HookExecutor } from './executor'
import { emptyOutcome, type HookEntry, type HookInput, type HookOutcome } from './types'

export interface DispatchInput {
  event: HookEvent
  matchValues: string[]
  payload: HookInput
  cwd: string
  env?: Record<string, string>
  signal?: AbortSignal
}

export interface HookDispatcher {
  run(input: DispatchInput): Promise<HookOutcome>
}

function matches(entry: HookEntry, values: string[]): boolean {
  return values.some((value) => entry.matches(value))
}

export function createHookDispatcher(deps: {
  executor: HookExecutor
  activeEntries: () => HookEntry[]
}): HookDispatcher {
  return {
    async run(input) {
      const handlers = deps
        .activeEntries()
        .filter((entry) => entry.event === input.event && matches(entry, input.matchValues))
        .sort((a, b) => a.displayOrder - b.displayOrder)

      if (handlers.length === 0) return emptyOutcome()

      const stdin = JSON.stringify(input.payload)
      const results = await Promise.all(
        handlers.map(async (entry) => {
          const result = await deps.executor.run({
            command: entry.command,
            ...(entry.commandWindows ? { commandWindows: entry.commandWindows } : {}),
            stdin,
            cwd: input.cwd,
            timeoutSec: entry.timeoutSec,
            ...(input.env ? { env: input.env } : {}),
            ...(input.signal ? { signal: input.signal } : {})
          })
          return { entry, outcome: parseHandlerResult(input.event, entry.key, result) }
        })
      )

      const aggregate = emptyOutcome()
      for (const { outcome } of results) {
        if (outcome.denied && !aggregate.denied) {
          aggregate.denied = true
          aggregate.denyReason = outcome.denyReason
        }
        if (outcome.stopped && !aggregate.stopped) {
          aggregate.stopped = true
          aggregate.stopReason = outcome.stopReason
        }
        if (outcome.feedback) aggregate.feedback.push(outcome.feedback)
        if (outcome.additionalContext) aggregate.additionalContext.push(outcome.additionalContext)
        aggregate.entries.push(...outcome.entries)
      }
      return aggregate
    }
  }
}
