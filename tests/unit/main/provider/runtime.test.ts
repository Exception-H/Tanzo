import { describe, expect, it, vi } from 'vitest'
import { TanzoValidationError } from '@shared/errors'
import { createProviderRuntime } from '@main/provider/runtime'

describe('main/provider/runtime', () => {
  it('resolves valid model refs and caches by credential fingerprint', () => {
    const loadCredentials = vi.fn(() => ({ apiKey: 'sk-1' }))
    const runtime = createProviderRuntime({ loadCredentials })

    const first = runtime.resolveLanguageModel('openai:gpt-5')
    const second = runtime.resolveLanguageModel('openai:gpt-5')

    expect(second).toBe(first)
    expect(loadCredentials).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed or unknown model refs', () => {
    const runtime = createProviderRuntime({ loadCredentials: () => ({ apiKey: 'sk' }) })

    expect(() => runtime.resolveLanguageModel('gpt-5')).toThrow(TanzoValidationError)
    expect(() => runtime.resolveLanguageModel('missing:gpt-5')).toThrow(TanzoValidationError)
    expect(() => runtime.resolveLanguageModel('openai:')).toThrow(TanzoValidationError)
  })
})
