import { createHash } from 'node:crypto'
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from 'ai'
import { PROVIDER_IDS, type ProviderId } from '@shared/provider'
import { TanzoValidationError } from '@shared/errors'
import { getAdapter, type Credentials } from './adapter'

export interface ProviderRuntime {
  resolveLanguageModel(modelRef: string): LanguageModel
  invalidate(providerId?: ProviderId): void
}

interface RuntimeDeps {
  loadCredentials(providerId: ProviderId, keyId?: string): Credentials
}

const MIDDLEWARE: LanguageModelMiddleware[] = []
const MAX_CACHE_ENTRIES = 32
const CACHE_KEY_SEPARATOR = '\u001f'

function credentialFingerprint(credentials: Credentials): string {
  const entries = Object.keys(credentials)
    .sort()
    .map((key) => [key, credentials[key]] as const)
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex')
}

function parseModelRef(modelRef: string): { providerId: ProviderId; modelId: string } {
  const separator = modelRef.indexOf(':')
  if (separator === -1) {
    throw new TanzoValidationError('PROVIDER_MODEL_REF_INVALID', `Invalid model ref: ${modelRef}`, {
      details: { modelRef }
    })
  }
  const prefix = modelRef.slice(0, separator)
  const modelId = modelRef.slice(separator + 1)
  if (!PROVIDER_IDS.includes(prefix as ProviderId) || !modelId) {
    throw new TanzoValidationError('PROVIDER_MODEL_REF_INVALID', `Invalid model ref: ${modelRef}`, {
      details: { modelRef }
    })
  }
  return { providerId: prefix as ProviderId, modelId }
}

export function createProviderRuntime(deps: RuntimeDeps): ProviderRuntime {
  const cache = new Map<string, LanguageModel>()

  function languageModel(providerId: ProviderId, modelId: string): LanguageModel {
    const credentials = deps.loadCredentials(providerId)
    const cacheKey = [providerId, modelId, credentialFingerprint(credentials)].join(
      CACHE_KEY_SEPARATOR
    )
    const cached = cache.get(cacheKey)
    if (cached) {
      cache.delete(cacheKey)
      cache.set(cacheKey, cached)
      return cached
    }

    const model = getAdapter(providerId).createLanguageModel(modelId, credentials)
    const wrapped =
      typeof model === 'string' ? model : wrapLanguageModel({ model, middleware: MIDDLEWARE })
    cache.set(cacheKey, wrapped)
    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
    return wrapped
  }

  return {
    resolveLanguageModel(modelRef) {
      const { providerId, modelId } = parseModelRef(modelRef)
      return languageModel(providerId, modelId)
    },
    invalidate(providerId) {
      if (!providerId) {
        cache.clear()
        return
      }
      const prefix = providerId + CACHE_KEY_SEPARATOR
      for (const key of [...cache.keys()]) {
        if (key.startsWith(prefix)) cache.delete(key)
      }
    }
  }
}
