import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HookEntrySummary } from '@shared/hooks'
import { hooksClient } from '@/platform/electron/hooks-client'

const HOOKS_STALE_TIME = 15_000
const HOOKS_GC_TIME = 5 * 60 * 1_000

export const hookKeys = {
  all: ['hooks'] as const,
  list: () => [...hookKeys.all, 'list'] as const
}

export function useHooksList() {
  return useQuery({
    queryKey: hookKeys.list(),
    queryFn: () => hooksClient.list(),
    staleTime: HOOKS_STALE_TIME,
    gcTime: HOOKS_GC_TIME
  })
}

export function useHookMutations() {
  const queryClient = useQueryClient()
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: hookKeys.all })
  }

  const reload = useMutation({
    mutationFn: () => hooksClient.reload(),
    onSuccess: (entries) => {
      queryClient.setQueryData<HookEntrySummary[]>(hookKeys.list(), entries)
    }
  })

  const setEnabled = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      hooksClient.setEnabled(key, enabled),
    onSuccess: invalidate
  })

  const trust = useMutation({
    mutationFn: ({ key, contentHash }: { key: string; contentHash: string }) =>
      hooksClient.setTrusted(key, contentHash),
    onSuccess: invalidate
  })

  return { reload, setEnabled, trust }
}
