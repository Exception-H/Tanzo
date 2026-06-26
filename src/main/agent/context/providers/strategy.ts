import type { CompiledContext } from '../section'

export type CacheKind = 'ephemeral' | 'auto' | 'unsupported'

export interface ProviderContextLayoutHelpers {
  freezeVolatilePrefix(plan: CompiledContext): CompiledContext
}

export interface ProviderContextStrategy {
  cacheKind: CacheKind
  applyPromptLayout?(plan: CompiledContext, helpers: ProviderContextLayoutHelpers): CompiledContext
  applyCaching(plan: CompiledContext): CompiledContext
}
