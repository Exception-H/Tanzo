export function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

export function includesQuery(value: string | undefined, query: string): boolean {
  if (!value) return false
  return value.toLowerCase().includes(query)
}
