import { describe, expect, it } from 'vitest'
import {
  getDefaultLanguageModel,
  type LanguageModelOption
} from '@renderer/features/chat/model/use-available-models'

function option(id: string, isDefault = false): LanguageModelOption {
  const [providerId, modelKey] = id.split(':') as [LanguageModelOption['providerId'], string]
  return {
    id,
    providerId,
    modelKey,
    name: modelKey,
    isDefault,
    providerDefaults: { callDefaults: {}, providerOptions: {}, rawProviderOptions: {} }
  }
}

describe('renderer/use-available-models', () => {
  it('selects the global default language model before falling back to the first model', () => {
    expect(
      getDefaultLanguageModel([option('openai:gpt-4.1'), option('anthropic:claude-4', true)])?.id
    ).toBe('anthropic:claude-4')

    expect(
      getDefaultLanguageModel([option('openai:gpt-4.1'), option('anthropic:claude-4')])?.id
    ).toBe('openai:gpt-4.1')
  })
})
