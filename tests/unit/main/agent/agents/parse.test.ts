import { describe, expect, it } from 'vitest'
import { AgentParseError, defFromMarkdown } from '@main/agent/agents/parse'

describe('main/agent/agents/parse', () => {
  it('builds agent definitions from markdown frontmatter', () => {
    expect(
      defFromMarkdown(
        `---
name: Planner
kind: subagent
description: Makes plans
model: openai:gpt-5
tools: fileRead, grep
enable-web-search: true
max-subagent-depth: 2
max-steps: 8
---
System prompt
`,
        'Fallback'
      )
    ).toEqual({
      id: 'Planner',
      name: 'Planner',
      kind: 'subagent',
      description: 'Makes plans',
      modelRef: 'openai:gpt-5',
      systemPrompt: 'System prompt',
      allowedTools: ['fileRead', 'grep'],
      enableWebSearch: true,
      maxSubagentDepth: 2,
      maxSteps: 8
    })
  })

  it('uses fallback name and directory kind when metadata omits them', () => {
    expect(defFromMarkdown('Prompt body', 'Explore', 'subagent')).toMatchObject({
      id: 'Explore',
      name: 'Explore',
      kind: 'subagent',
      systemPrompt: 'Prompt body',
      allowedTools: null
    })
  })

  it('rejects invalid kind and blank names', () => {
    expect(() => defFromMarkdown('---\nkind: other\n---\nBody', 'Fallback')).toThrow(
      AgentParseError
    )
    expect(() => defFromMarkdown('Body', '')).toThrow('agent definition is missing a name')
  })
})
