export function toTranslationKeySegment(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}
