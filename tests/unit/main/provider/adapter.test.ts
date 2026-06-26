import { afterEach, describe, expect, it, vi } from 'vitest'
import { TanzoNotFoundError, TanzoValidationError } from '@shared/errors'
import type { ProviderId } from '@shared/provider'
import { getAdapter } from '@main/provider/adapter'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('main/provider/adapter', () => {
  it('returns typed adapters and rejects unknown providers', () => {
    expect(getAdapter('openai').providerId).toBe('openai')
    expect(() => getAdapter('missing' as ProviderId)).toThrow(TanzoNotFoundError)
  })

  it('validates required credentials before remote model fetches', async () => {
    await expect(getAdapter('openai').fetchModels({}, 'language')).rejects.toMatchObject({
      code: 'PROVIDER_CREDENTIALS_MISSING',
      details: { providerId: 'openai', missing: 'apiKey' }
    })
    await expect(getAdapter('openai-compatible').fetchModels({}, 'language')).rejects.toThrow(
      TanzoValidationError
    )
  })

  it('fetches and maps OpenAI models by family', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: [
            { id: 'gpt-5', owned_by: 'openai' },
            { id: 'text-embedding-3-large', owned_by: 'openai' },
            { id: 'whisper-1', owned_by: 'openai' }
          ]
        })
      )
    )

    await expect(
      getAdapter('openai').fetchModels({ apiKey: 'sk', baseUrl: 'api.openai.com' }, 'language')
    ).resolves.toEqual([
      {
        id: 'gpt-5',
        name: 'Gpt 5',
        description: 'Owned by openai'
      }
    ])
    await expect(getAdapter('openai').fetchModels({ apiKey: 'sk' }, 'embedding')).resolves.toEqual([
      expect.objectContaining({ id: 'text-embedding-3-large', dimensions: 3072 })
    ])
  })

  it('maps Google model discovery payloads by supported generation methods', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          models: [
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini Pro',
              supportedGenerationMethods: ['generateContent']
            },
            {
              name: 'models/text-embedding-004',
              supportedGenerationMethods: ['embedContent']
            }
          ]
        })
      )
    )

    await expect(getAdapter('google').fetchModels({ apiKey: 'key' }, 'language')).resolves.toEqual([
      expect.objectContaining({ id: 'gemini-2.5-pro', name: 'Gemini Pro' })
    ])
    await expect(getAdapter('google').fetchModels({ apiKey: 'key' }, 'embedding')).resolves.toEqual(
      [expect.objectContaining({ id: 'text-embedding-004' })]
    )
  })

  it('returns Anthropic connection result from model discovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' }],
          has_more: false
        })
      )
    )

    await expect(getAdapter('anthropic').testConnection({ apiKey: '' })).resolves.toEqual({
      success: false,
      message: 'Missing required credentials.'
    })
    await expect(
      getAdapter('anthropic').testConnection({ apiKey: 'sk-ant' })
    ).resolves.toMatchObject({
      success: true,
      modelCount: 1
    })
  })
})
