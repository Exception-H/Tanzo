import { describe, expect, it } from 'vitest'
import type { AgentDefinition } from '@main/agent/agents/types'
import { providerTools } from '@main/agent/tools/provider'

const baseDef: AgentDefinition = {
  id: 'main',
  name: 'Main',
  description: 'Main',
  kind: 'main',
  modelRef: 'openai:gpt-4.1',
  systemPrompt: '',
  allowedTools: null
}

describe('agent/tools/provider', () => {
  it('temporarily disables provider web search tools', () => {
    expect(providerTools({ ...baseDef, modelRef: 'openai:gpt' })).toEqual({})
    expect(providerTools({ ...baseDef, modelRef: 'openai:gpt', enableWebSearch: true })).toEqual({})
    expect(
      providerTools({ ...baseDef, modelRef: 'anthropic:claude', enableWebSearch: true })
    ).toEqual({})
    expect(providerTools({ ...baseDef, modelRef: 'google:gemini', enableWebSearch: true })).toEqual(
      {}
    )
  })
})
