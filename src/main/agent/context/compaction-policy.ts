import type { ModelCapabilities } from './capabilities'

export interface CompactionPolicy {
  compactionTriggerTokens: number
  retainedRecentSteps: number
}

const AUTO_COMPACT_INPUT_WINDOW_FRACTION = 0.9
const RETAIN_RECENT_STEPS = 6

export function computeCompactionPolicy(cap: ModelCapabilities): CompactionPolicy {
  const inputWindowTokens = Math.max(cap.contextWindow - cap.maxOutputTokens, 0)
  const compactionTriggerTokens = Math.floor(inputWindowTokens * AUTO_COMPACT_INPUT_WINDOW_FRACTION)
  return {
    compactionTriggerTokens,
    retainedRecentSteps: RETAIN_RECENT_STEPS
  }
}
