import { describe, expect, it } from 'vitest'
import { HeadTailBuffer, truncateHead } from '@main/agent/tools/text-output'

describe('main/agent/tools/text-output', () => {
  it('keeps complete output while below the buffer limit', () => {
    const buffer = new HeadTailBuffer(12)
    buffer.push('hello')
    buffer.push(' world')

    expect(buffer.toString()).toBe('hello world')
  })

  it('keeps head and tail with a truncation marker for long output', () => {
    const buffer = new HeadTailBuffer(8)
    buffer.push('abcdefghijklmnop')

    expect(buffer.toString()).toBe('abcd\n…<8 chars truncated>…\nmnop')
  })

  it('truncates simple head output with metadata', () => {
    expect(truncateHead('abcdef', 3)).toEqual({ text: 'abc', truncated: true })
    expect(truncateHead('abc', 3)).toEqual({ text: 'abc', truncated: false })
  })
})
