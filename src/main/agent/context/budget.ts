import type { LanguageModelUsage, ModelMessage } from 'ai'

export interface Anchor {
  messageCount: number
  inputTokens: number
}

export interface ContextUsage {
  inputTokens?: number
  source: 'reported' | 'unavailable'
  exceeds(tokenCount: number): boolean
}

export function createBudget() {
  const anchors = new Map<string, Anchor>()

  function anchor(chatId: string, messageCount: number, inputTokens: number): void {
    if (inputTokens > 0) anchors.set(chatId, { messageCount, inputTokens })
  }

  function reportedInput(chatId: string): { tokens?: number; source: 'reported' | 'unavailable' } {
    const a = anchors.get(chatId)
    return a ? { tokens: a.inputTokens, source: 'reported' } : { source: 'unavailable' }
  }

  function measureUsage(chatId: string, _messages: ModelMessage[]): ContextUsage {
    void _messages
    const { tokens, source } = reportedInput(chatId)
    return {
      ...(tokens !== undefined ? { inputTokens: tokens } : {}),
      source,
      exceeds: (tokenCount: number) => tokens !== undefined && tokens > tokenCount
    }
  }

  function clear(chatId: string): void {
    anchors.delete(chatId)
  }

  return { anchor, reportedInput, measureUsage, clear }
}

export type Budget = ReturnType<typeof createBudget>

export function cacheHitRatio(usage: LanguageModelUsage | undefined): number | undefined {
  const input = usage?.inputTokens
  const cached = usage?.inputTokenDetails?.cacheReadTokens
  if (input == null || input <= 0 || cached == null) return undefined
  return cached / input
}
