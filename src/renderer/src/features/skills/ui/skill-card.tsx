import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CardDescription,
  CardDivider,
  CardFooter,
  CardHeader,
  CardStatusBadge,
  FeatureCard
} from '@/components/ui/feature-card'
import { Switch } from '@/components/ui/switch'
import type { SkillSummary } from '@shared/skills'
import { skillTitle } from '../model'
import { AllowedToolsBadge, ScopeBadge } from './skill-badges'

export function SkillCard({
  skill,
  onOpen,
  onToggle
}: {
  skill: SkillSummary
  onOpen: (skill: SkillSummary) => void
  onToggle: (skill: SkillSummary, enabled: boolean) => void
}): React.ReactElement {
  const { t } = useTranslation()
  return (
    <FeatureCard active={skill.enabled} disabled={!skill.enabled} onClick={() => onOpen(skill)}>
      <div className="flex-1">
        <CardHeader
          title={skillTitle(skill)}
          badge={<ScopeBadge skill={skill} />}
          actions={
            <Switch
              size="sm"
              checked={skill.enabled}
              aria-label={t('skills.card.toggleAria', { name: skill.name })}
              onCheckedChange={(checked) => onToggle(skill, Boolean(checked))}
            />
          }
        >
          <CardDescription>{skill.description}</CardDescription>
        </CardHeader>
      </div>

      <CardDivider />

      <CardFooter>
        <CardStatusBadge
          active={skill.enabled}
          activeIcon={<CheckCircle2 className="size-3 text-background" />}
          activeText={t('skills.status.enabled')}
          inactiveText={t('skills.status.disabled')}
        />
        <AllowedToolsBadge skill={skill} />
      </CardFooter>
    </FeatureCard>
  )
}
