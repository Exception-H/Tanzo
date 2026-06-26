import { describe, expect, it } from 'vitest'
import { isSafeExternalHref, isSafeImageSrc } from '@renderer/features/chat/ui/message/href-safety'

describe('renderer/message href safety', () => {
  it('allows only safe external link protocols', () => {
    expect(isSafeExternalHref('https://example.com')).toBe(true)
    expect(isSafeExternalHref('http://example.com')).toBe(true)
    expect(isSafeExternalHref('mailto:hello@example.com')).toBe(true)
    expect(isSafeExternalHref('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalHref('file:///etc/passwd')).toBe(false)
    expect(isSafeExternalHref('/relative/path')).toBe(false)
  })

  it('allows only http image sources', () => {
    expect(isSafeImageSrc('https://example.com/image.png')).toBe(true)
    expect(isSafeImageSrc('http://example.com/image.png')).toBe(true)
    expect(isSafeImageSrc('data:image/png;base64,abc')).toBe(false)
    expect(isSafeImageSrc('javascript:alert(1)')).toBe(false)
  })
})
