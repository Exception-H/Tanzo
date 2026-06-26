import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { LanguageModel } from 'ai'
import type { ModelFamily, ProviderId } from '@shared/provider'
import type { ProviderService } from '../../provider/service'

const DEFAULT_MAX_RETRIES = 5

export interface CallSettings {
  maxRetries?: number
  maxOutputTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  presencePenalty?: number
  frequencyPenalty?: number
  seed?: number
  stopSequences?: string[]
}

export interface LanguageModelConfig {
  model: LanguageModel
  callSettings: CallSettings
  providerOptions: ProviderOptions
}

export function resolveLanguageModelConfig(
  providerService: ProviderService,
  modelRef: string,
  family: ModelFamily = 'language'
): LanguageModelConfig {
  const providerId = modelRef.split(':', 1)[0] as ProviderId
  return {
    model: providerService.resolveLanguageModel(modelRef),
    callSettings: pickCallSettings(providerService.getCallSettings(providerId, family)),
    providerOptions: providerService.getProviderOptions(providerId, family)
  }
}

export function hasProviderOptions(options: ProviderOptions): boolean {
  return Object.keys(options).length > 0
}

function pickCallSettings(raw: Record<string, unknown>): CallSettings {
  const out: CallSettings = {}
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const r = num(raw.maxRetries)
  out.maxRetries = r !== undefined ? r : DEFAULT_MAX_RETRIES
  const m = num(raw.maxOutputTokens)
  if (m !== undefined) out.maxOutputTokens = m
  const t = num(raw.temperature)
  if (t !== undefined) out.temperature = t
  const tp = num(raw.topP)
  if (tp !== undefined) out.topP = tp
  const tk = num(raw.topK)
  if (tk !== undefined) out.topK = tk
  const pp = num(raw.presencePenalty)
  if (pp !== undefined) out.presencePenalty = pp
  const fp = num(raw.frequencyPenalty)
  if (fp !== undefined) out.frequencyPenalty = fp
  const s = num(raw.seed)
  if (s !== undefined) out.seed = s
  if (Array.isArray(raw.stopSequences)) {
    const seqs = raw.stopSequences.filter((x): x is string => typeof x === 'string')
    if (seqs.length > 0) out.stopSequences = seqs
  }
  return out
}
