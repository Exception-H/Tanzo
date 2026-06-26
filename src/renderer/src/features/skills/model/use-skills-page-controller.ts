import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { FilterGroup } from '@/components/layout/page-scaffold'
import type { ActiveFilters } from '@/components/ui/search-input'
import type { InstallSkillInput, SkillSummary } from '@shared/skills'
import { errorMessage } from '@/common/lib/error-utils'
import { useSkillDetail, useSkillMutations, useSkillsSnapshot } from './queries'
import { matchesSkillFilters, skillSearchText } from './skill-filtering'

const EMPTY_SKILLS: SkillSummary[] = []

export function useSkillsPageController() {
  const { t } = useTranslation()
  const snapshotQuery = useSkillsSnapshot()
  const mutations = useSkillMutations()

  const [searchValue, setSearchValue] = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null)
  const [installOpen, setInstallOpen] = useState(false)

  const detailQuery = useSkillDetail(selectedName)
  const skills = snapshotQuery.data?.skills ?? EMPTY_SKILLS

  const filteredSkills = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    return skills.filter(
      (skill) =>
        matchesSkillFilters(skill, activeFilters) &&
        (!query || skillSearchText(skill).includes(query))
    )
  }, [activeFilters, searchValue, skills])

  const enabledSkills = useMemo(
    () => filteredSkills.filter((skill) => skill.enabled),
    [filteredSkills]
  )
  const disabledSkills = useMemo(
    () => filteredSkills.filter((skill) => !skill.enabled),
    [filteredSkills]
  )

  const stats = useMemo(
    () => [
      { value: skills.length, label: t('skills.page.stats.skills') },
      {
        value: skills.filter((skill) => skill.enabled).length,
        label: t('skills.page.stats.enabled')
      },
      {
        value: skills.filter((skill) => skill.installed).length,
        label: t('skills.page.stats.installed')
      }
    ],
    [skills, t]
  )

  const filterGroups: FilterGroup[] = useMemo(
    () => [
      {
        key: 'scope',
        label: t('skills.filters.scope.label'),
        options: [
          { value: 'user', label: t('skills.scope.user') },
          { value: 'workspace', label: t('skills.scope.workspace') }
        ]
      },
      {
        key: 'status',
        label: t('skills.filters.status.label'),
        options: [
          { value: 'enabled', label: t('common.status.enabled') },
          { value: 'disabled', label: t('common.status.disabled') }
        ]
      },
      {
        key: 'installed',
        label: t('skills.filters.source.label'),
        options: [
          { value: 'installed', label: t('skills.source.installed') },
          { value: 'scanned', label: t('skills.source.scanned') }
        ]
      }
    ],
    [t]
  )

  function handleFilterChange(key: string, value: string | undefined): void {
    setActiveFilters((current) => ({ ...current, [key]: value }))
  }

  async function toggleSkill(skill: SkillSummary, enabled: boolean): Promise<void> {
    try {
      await mutations.setEnabled.mutateAsync({ name: skill.name, enabled })
    } catch (error) {
      toast.error(errorMessage(error, t('skills.toast.updateFailed')))
    }
  }

  async function installSkill(input: InstallSkillInput): Promise<void> {
    await mutations.install.mutateAsync(input)
    toast.success(t('skills.toast.installed'))
    setInstallOpen(false)
  }

  async function confirmUninstall(): Promise<void> {
    if (!deleteTarget) return
    try {
      await mutations.uninstall.mutateAsync(deleteTarget.name)
      if (selectedName === deleteTarget.name) setSelectedName(null)
      setDeleteTarget(null)
      toast.success(t('skills.toast.uninstalled'))
    } catch (error) {
      toast.error(errorMessage(error, t('skills.toast.uninstallFailed')))
    }
  }

  async function reload(): Promise<void> {
    try {
      await mutations.reload.mutateAsync()
    } catch (error) {
      toast.error(errorMessage(error, t('skills.toast.reloadFailed')))
    }
  }

  return {
    loading: snapshotQuery.isLoading,
    reloading: mutations.reload.isPending,
    installing: mutations.install.isPending,
    detailLoading: detailQuery.isPending && selectedName !== null,
    skills,
    filteredSkills,
    enabledSkills,
    disabledSkills,
    stats,
    searchValue,
    setSearchValue,
    activeFilters,
    filterGroups,
    handleFilterChange,
    selectedName,
    selectedSkill: detailQuery.data ?? null,
    openDetail: (skill: SkillSummary) => setSelectedName(skill.name),
    closeDetail: () => setSelectedName(null),
    deleteTarget,
    setDeleteTarget,
    installOpen,
    setInstallOpen,
    toggleSkill,
    installSkill,
    confirmUninstall,
    reload
  }
}
