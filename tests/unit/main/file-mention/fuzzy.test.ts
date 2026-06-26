import { describe, expect, it } from 'vitest'
import { fuzzyMatch } from '@main/file-mention/fuzzy'

describe('file-mention/fuzzy', () => {
  it('treats an empty needle as a low-priority match', () => {
    const result = fuzzyMatch('anything', '')
    expect(result.matched).toBe(true)
    expect(result.score).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('rewards a prefix match with a -100 bonus', () => {
    expect(fuzzyMatch('file_name', 'file').score).toBe(-100)
  })

  it('scores a contiguous non-prefix match as zero', () => {
    expect(fuzzyMatch('my_file', 'file').score).toBe(0)
  })

  it('penalises scattered non-prefix matches by their span', () => {
    expect(fuzzyMatch('x_a_b_c', 'abc').score).toBe(2)
  })

  it('is case insensitive', () => {
    expect(fuzzyMatch('FooBar', 'foo').score).toBe(-100)
  })

  it('reports no match when the subsequence is absent', () => {
    expect(fuzzyMatch('hello', 'xyz').matched).toBe(false)
  })

  it('ranks a tighter non-prefix match above a more scattered one', () => {
    const tight = fuzzyMatch('my_file', 'file').score
    const loose = fuzzyMatch('m_f_i_l_e', 'file').score
    expect(tight).toBeLessThan(loose)
  })
})
