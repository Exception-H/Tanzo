export const skillKeys = {
  all: ['skills'] as const,
  snapshot: () => [...skillKeys.all, 'snapshot'] as const,
  detail: (name: string) => [...skillKeys.all, 'detail', name] as const
}
