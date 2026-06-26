import { isDynamicToolUIPart, isToolUIPart, type UIMessagePart } from 'ai'
import type { TanzoUIMessage } from '@shared/agent-message'

const INCOMPLETE_INPUT_TOOL_STATES = new Set(['input-streaming', 'input-available'])

function isToolPart(part: TanzoUIMessage['parts'][number]): boolean {
  return (
    isToolUIPart(part as UIMessagePart<never, never>) ||
    isDynamicToolUIPart(part as UIMessagePart<never, never>)
  )
}

export function stripIncompleteInputToolParts(messages: TanzoUIMessage[]): TanzoUIMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'assistant') return [message]

    let changed = false
    const parts = message.parts.filter((part) => {
      if (!isToolPart(part)) return true
      const state = (part as { state?: string }).state
      const keep = !state || !INCOMPLETE_INPUT_TOOL_STATES.has(state)
      if (!keep) changed = true
      return keep
    })

    if (!changed) return [message]
    return parts.length > 0 ? [{ ...message, parts }] : []
  })
}
