import { createDeepSeek } from '@ai-sdk/deepseek'
import { TanzoValidationError } from '@shared/errors'
import { ensureUrlProtocol, fetchJson, idOnlyModelListSchema } from '../http'
import type { ProviderAdapter } from '../adapter-types'
import { bearer, credentialText, mapIdModels, testByFetching, TIMEOUTS } from '../adapter-utils'

export const deepseekAdapter: ProviderAdapter = {
  providerId: 'deepseek',
  validateCredentials: (credentials) => Boolean(credentials.apiKey?.trim()),
  createLanguageModel(modelId, credentials) {
    return createDeepSeek({
      apiKey: credentialText(credentials.apiKey),
      baseURL: ensureUrlProtocol(credentials.baseUrl, 'https://api.deepseek.com')
    }).chat(modelId)
  },
  async fetchModels(credentials, family) {
    if (family !== 'language') return []
    if (!this.validateCredentials(credentials))
      throw new TanzoValidationError(
        'PROVIDER_CREDENTIALS_MISSING',
        'Missing required credentials: apiKey',
        {
          details: { providerId: 'deepseek', missing: 'apiKey' }
        }
      )
    const baseUrl = ensureUrlProtocol(credentials.baseUrl, 'https://api.deepseek.com').replace(
      /\/+$/,
      ''
    )
    const data = await fetchJson(
      `${baseUrl}/models`,
      (value) => idOnlyModelListSchema.parse(value),
      {
        timeout: TIMEOUTS.MODEL_FETCH,
        headers: bearer(credentials.apiKey)
      }
    )
    return mapIdModels(data.data, family, 'DeepSeek model')
  },
  testConnection(credentials) {
    return testByFetching(this, credentials)
  }
}
