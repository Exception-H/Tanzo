import { describe, expect, it } from 'vitest'
import { TanzoNotFoundError } from '@shared/errors'
import { PROVIDER_IDS, type ProviderId } from '@shared/provider'
import { getProvider, getSupportedFamilies, listProviders } from '@main/provider/catalog'

describe('main/provider/catalog', () => {
  it('lists every shared provider id exactly once', () => {
    expect(
      listProviders()
        .map((provider) => provider.id)
        .sort()
    ).toEqual([...PROVIDER_IDS].sort())
  })

  it('returns provider descriptors with credential metadata', () => {
    const openai = getProvider('openai')

    expect(openai.name).toBe('OpenAI')
    expect(openai.credentialFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'apiKey', required: true, secret: true }),
        expect.objectContaining({ key: 'baseUrl', required: false, secret: false })
      ])
    )
  })

  it('derives supported families from provider descriptors', () => {
    expect(getSupportedFamilies('anthropic')).toEqual(['language'])
    expect(getSupportedFamilies('openai-compatible')).toEqual(['language', 'embedding', 'image'])
  })

  it('throws a typed not-found error for unknown providers', () => {
    expect(() => getProvider('missing' as ProviderId)).toThrow(TanzoNotFoundError)
    expect(() => getProvider('missing' as ProviderId)).toThrow('Unknown provider: missing')
  })
})
