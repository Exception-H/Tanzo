import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InstallSkillInput, SetSkillEnabledInput } from '@shared/skills'
import { skillsClient } from '@/platform/electron/skills-client'
import { skillKeys } from './query-keys'

const SKILL_STALE_TIME = 30_000
const SKILL_GC_TIME = 30 * 60 * 1_000

export function useSkillsSnapshot() {
  return useQuery({
    queryKey: skillKeys.snapshot(),
    queryFn: () => skillsClient.listSkills(),
    staleTime: SKILL_STALE_TIME,
    gcTime: SKILL_GC_TIME
  })
}

export function useSkillDetail(name: string | null) {
  return useQuery({
    queryKey: skillKeys.detail(name ?? ''),
    queryFn: () => skillsClient.getSkill(name as string),
    enabled: name !== null,
    staleTime: SKILL_STALE_TIME,
    gcTime: SKILL_GC_TIME
  })
}

export function useSkillMutations() {
  const queryClient = useQueryClient()
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: skillKeys.all })
  }

  const setEnabled = useMutation({
    mutationFn: (input: SetSkillEnabledInput) => skillsClient.setSkillEnabled(input),
    onSuccess: invalidate
  })
  const install = useMutation({
    mutationFn: (input: InstallSkillInput) => skillsClient.installSkill(input),
    onSuccess: invalidate
  })
  const uninstall = useMutation({
    mutationFn: (name: string) => skillsClient.uninstallSkill(name),
    onSuccess: invalidate
  })
  const reload = useMutation({
    mutationFn: () => skillsClient.reloadSkills(),
    onSuccess: invalidate
  })

  return { setEnabled, install, uninstall, reload }
}
