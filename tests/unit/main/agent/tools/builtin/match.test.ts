import { describe, expect, it } from 'vitest'
import { applyReplacements, locate } from '@main/agent/tools/builtin/match'

describe('main/agent/tools/builtin/match', () => {
  it('locates exact and normalized text matches', () => {
    expect(locate('alpha beta alpha', 'alpha')).toEqual({ starts: [0, 11], length: 5 })
    expect(locate('quote “hello”', 'quote "hello"')).toEqual({ starts: [0], length: 13 })
    expect(locate('line\n', 'line\n')).toEqual({ starts: [0], length: 5 })
  })

  it('falls back to newline-normalized and outer-newline-trimmed matches', () => {
    expect(locate('line', 'line\n')).toEqual({ starts: [0], length: 4 })
    expect(locate('one\ntwo', 'one\r\ntwo')).toEqual({ starts: [0], length: 7 })
    expect(locate('one\ntwo', '\none\ntwo\n')).toEqual({ starts: [0], length: 7 })
  })

  it('applies replacements from the end to preserve earlier offsets', () => {
    expect(applyReplacements('one two one', [0, 8], 3, '1')).toBe('1 two 1')
  })
})
