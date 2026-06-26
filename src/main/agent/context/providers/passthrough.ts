import type { ProviderContextStrategy } from './strategy'

export function createGoogleStrategy(): ProviderContextStrategy {
  return {
    cacheKind: 'auto',
    applyCaching: (plan) => plan
  }
}
