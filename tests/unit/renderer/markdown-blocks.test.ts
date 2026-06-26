import { describe, expect, it } from 'vitest'
import { splitMarkdownBlocks } from '@renderer/features/chat/ui/message/markdown-blocks'

describe('renderer/markdown-blocks', () => {
  it('splits paragraphs on blank lines', () => {
    expect(splitMarkdownBlocks('first paragraph\n\nsecond paragraph\n\n- a\n- b')).toEqual([
      'first paragraph',
      'second paragraph',
      '- a\n- b'
    ])
  })

  it('keeps fenced code with inner blank lines as a single block', () => {
    const content = 'intro\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\noutro'
    expect(splitMarkdownBlocks(content)).toEqual([
      'intro',
      '```ts\nconst a = 1\n\nconst b = 2\n```',
      'outro'
    ])
  })

  it('keeps an unterminated streaming fence as one tail block', () => {
    const content = 'text before\n\n```python\nprint("hi")\n\nprint("still streaming'
    expect(splitMarkdownBlocks(content)).toEqual([
      'text before',
      '```python\nprint("hi")\n\nprint("still streaming'
    ])
  })

  it('produces stable prefix blocks while streaming appends content', () => {
    const before = splitMarkdownBlocks('alpha\n\nbeta')
    const after = splitMarkdownBlocks('alpha\n\nbeta continues\n\ngamma')
    expect(after[0]).toBe(before[0])
    expect(after).toEqual(['alpha', 'beta continues', 'gamma'])
  })

  it('drops whitespace-only fragments', () => {
    expect(splitMarkdownBlocks('\n\n  \n\nonly block\n\n')).toEqual(['only block'])
  })
})
