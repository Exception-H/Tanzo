import { describe, expect, it } from 'vitest'
import { isToolError } from '@renderer/features/chat/ui/tool/renderers/shared'

describe('chat/tool-renderers/isToolError', () => {
  it('is true only for objects with error === true', () => {
    expect(isToolError({ error: true, message: 'boom' })).toBe(true)
  })

  it('is false for non-error objects', () => {
    expect(isToolError({ error: false })).toBe(false)
    expect(isToolError({ ok: true })).toBe(false)
  })

  it('is false for nullish and primitives', () => {
    expect(isToolError(undefined)).toBe(false)
    expect(isToolError(null)).toBe(false)
    expect(isToolError('error')).toBe(false)
    expect(isToolError(42)).toBe(false)
  })
})
