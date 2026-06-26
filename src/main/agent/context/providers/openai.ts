import type { CompiledContext } from '../section'
import type { ProviderContextStrategy } from './strategy'

function globalPromptCacheKey(modelRef: string): string {
  return `tanzo:global:${modelRef}`
}

function withPromptCacheKey(
  plan: CompiledContext,
  modelRef: string,
  providerKey: 'openai' | 'openaiCompatible'
): CompiledContext {
  const prev = plan.providerOptions ?? {}
  const prevOptions = (prev[providerKey] as Record<string, unknown> | undefined) ?? {}
  const options = {
    ...prevOptions,
    promptCacheKey: globalPromptCacheKey(modelRef),
    promptCacheRetention: '24h'
  }
  return {
    ...plan,
    providerOptions: {
      ...prev,
      [providerKey]: options
    }
  }
}

export function createOpenAIStrategy(modelRef: string): ProviderContextStrategy {
  return {
    cacheKind: 'auto',
    applyCaching: (plan) => withPromptCacheKey(plan, modelRef, 'openai')
  }
}

export function createOpenAICompatibleStrategy(modelRef: string): ProviderContextStrategy {
  return {
    cacheKind: 'auto',
    applyCaching: (plan) => withPromptCacheKey(plan, modelRef, 'openaiCompatible')
  }
}
