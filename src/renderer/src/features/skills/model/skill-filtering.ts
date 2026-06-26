import type { ActiveFilters } from '@/components/ui/search-input'
import type { SkillSummary } from '@shared/skills'

export function skillSearchText(skill: SkillSummary): string {
  return [skill.name, skill.description, skill.scope, ...(skill.allowedTools ?? [])]
    .join(' ')
    .toLowerCase()
}

export function matchesSkillFilters(skill: SkillSummary, filters: ActiveFilters): boolean {
  if (filters.scope && skill.scope !== filters.scope) return false
  if (filters.status === 'enabled' && !skill.enabled) return false
  if (filters.status === 'disabled' && skill.enabled) return false
  if (filters.installed === 'installed' && !skill.installed) return false
  if (filters.installed === 'scanned' && skill.installed) return false
  return true
}
