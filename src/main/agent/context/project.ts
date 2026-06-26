import type { ModelMessage } from 'ai'
import type { ModelCapabilities } from './capabilities'
import { canonicalizeToolTranscript } from './tool-transcript'

export function projectHistory(messages: ModelMessage[], _cap: ModelCapabilities): ModelMessage[] {
  void _cap
  return canonicalizeToolTranscript(messages)
}
