import { describe, expect, it } from 'vitest'
import { detectNativeWindowEffect } from '@shared/system'

describe('shared/system', () => {
  it('selects native window effects by platform and OS build', () => {
    expect(detectNativeWindowEffect('darwin', '25.0.0')).toBe('vibrancy')
    expect(detectNativeWindowEffect('win32', '10.0.22631')).toBe('acrylic')
    expect(detectNativeWindowEffect('win32', '10.0.19045')).toBeNull()
    expect(detectNativeWindowEffect('linux', '6.8.0')).toBeNull()
  })
})
