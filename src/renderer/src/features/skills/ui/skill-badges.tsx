import { Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { SkillSummary } from '@shared/skills'

export function ScopeBadge({ skill }: { skill: SkillSummary }): React.ReactElement {
  const { t } = useTranslation()
  return (
    <Badge
      variant={skill.scope === 'workspace' ? 'default' : 'outline'}
      className="h-5 rounded-md px-1.5 text-[0.6875rem] leading-none"
    >
      {t(`skills.scope.${skill.scope}`)}
    </Badge>
  )
}

export function AllowedToolsBadge({ skill }: { skill: SkillSummary }): React.ReactElement | null {
  const { t } = useTranslation()
  if (!skill.allowedTools || skill.allowedTools.length === 0) return null
  return (
    <Badge
      variant="secondary"
      className="h-5 gap-1 rounded-md px-1.5 text-[0.6875rem] leading-none"
    >
      <Wrench className="size-3" />
      {t('skills.card.toolCount', { count: skill.allowedTools.length })}
    </Badge>
  )
}
