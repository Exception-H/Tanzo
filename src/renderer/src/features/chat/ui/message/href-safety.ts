export function isCitationHref(href: string): boolean {
  return !href.startsWith('http') && !href.startsWith('/') && !href.startsWith('#')
}

export function isSafeExternalHref(href: string): boolean {
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
  } catch {
    return false
  }
}

export function isSafeImageSrc(src: string): boolean {
  try {
    const url = new URL(src)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
