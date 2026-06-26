import { describe, expect, it } from 'vitest'
import { isStructuredToolError, toolResultToModelOutput } from '@main/agent/tools/model-output'

describe('main/agent/tools/model-output', () => {
  it('recognizes structured tool errors', () => {
    expect(isStructuredToolError({ error: true, message: 'nope' })).toBe(true)
    expect(isStructuredToolError({ error: true, message: 42 })).toBe(false)
  })

  it('maps tool results to model outputs', () => {
    expect(toolResultToModelOutput({ output: { error: true, message: 'failed' } })).toEqual({
      type: 'error-text',
      value: 'failed'
    })
    expect(toolResultToModelOutput({ output: 'plain' })).toEqual({ type: 'text', value: 'plain' })
    expect(toolResultToModelOutput({ output: { ok: true } })).toEqual({
      type: 'json',
      value: { ok: true }
    })
  })
})
