import type { ProviderContextStrategy } from './strategy'

export function createDeepseekStrategy(): ProviderContextStrategy {
  return {
    cacheKind: 'auto',
    applyPromptLayout: (plan, helpers) => helpers.freezeVolatilePrefix(plan),
    applyCaching: (plan) => plan
  }
}
