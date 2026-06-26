import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '@main/agent/skills/frontmatter'

describe('main/agent/skills/frontmatter', () => {
  it('parses simple values, inline lists, block lists, comments, and body text', () => {
    expect(
      parseFrontmatter(`\uFEFF---
name: "General"
description: Helpful agent
tools: [fileRead, "grep"]
ignored:
  - nope
servers:
  - fs
  - git
# comment
---
Body text
`)
    ).toEqual({
      data: {
        name: 'General',
        description: 'Helpful agent',
        tools: ['fileRead', 'grep'],
        ignored: ['nope'],
        servers: ['fs', 'git']
      },
      body: 'Body text\n'
    })
  })

  it('returns normalized body when no frontmatter is present', () => {
    expect(parseFrontmatter('hello\r\nworld')).toEqual({
      data: {},
      body: 'hello\nworld'
    })
  })
})
