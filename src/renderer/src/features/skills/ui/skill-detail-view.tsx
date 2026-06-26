import { FileText, Info, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EntityDetailScaffold } from '@/components/layout/page-scaffold'
import type { SkillDetail } from '@shared/skills'
import { skillTitle } from '../model'
import { ScopeBadge } from './skill-badges'

const DETAIL_CONTENT_CLASS = 'mx-auto w-full max-w-4xl'

function DetailCard({
  icon: Icon,
  title,
  children,
  bodyClassName
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
  bodyClassName?: string
}): React.ReactElement {
  return (
    <section className="not-prose overflow-hidden rounded-[var(--radius-xl)] border border-border/15 bg-card/85 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted/35 text-foreground/68 ring-1 ring-inset ring-border/15">
          <Icon className="size-3" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium leading-tight tracking-[0.01em] text-foreground/90">
          {title}
        </h2>
      </div>
      <div className={bodyClassName ?? 'border-t border-border/10 p-3.5'}>{children}</div>
    </section>
  )
}

function DetailField({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-[0.625rem] font-medium uppercase tracking-[0.04em] text-foreground/45">
        {label}
      </dt>
      <dd className="break-words text-[0.8125rem] text-foreground/90">{value}</dd>
    </div>
  )
}

export function SkillDetailView({
  skill,
  onBack,
  onUninstall
}: {
  skill: SkillDetail
  onBack: () => void
  onUninstall: (skill: SkillDetail) => void
}): React.ReactElement {
  const { t } = useTranslation()

  return (
    <EntityDetailScaffold
      title={skillTitle(skill)}
      onBack={onBack}
      actions={
        skill.installed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2.5 text-xs"
            onClick={() => onUninstall(skill)}
          >
            <Trash2 className="size-3" />
            {t('skills.detail.uninstall')}
          </Button>
        ) : undefined
      }
    >
      <div className={DETAIL_CONTENT_CLASS}>
        <div className="space-y-4 pt-4 text-sm">
          <p className="text-[0.8125rem] leading-5 text-muted-foreground">{skill.description}</p>

          <div className="flex flex-wrap items-center gap-1.5">
            <ScopeBadge skill={skill} />
            <Badge
              variant={skill.enabled ? 'secondary' : 'outline'}
              className="h-5 rounded-md px-1.5 text-[0.6875rem] leading-none"
            >
              {skill.enabled
                ? t('skills.detail.badges.enabled')
                : t('skills.detail.badges.disabled')}
            </Badge>
            {skill.installed ? (
              <Badge
                variant="secondary"
                className="h-5 rounded-md px-1.5 text-[0.6875rem] leading-none"
              >
                {t('skills.detail.badges.installed')}
              </Badge>
            ) : null}
          </div>

          <DetailCard icon={Info} title={t('skills.detail.sections.details')}>
            <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <DetailField label={t('skills.detail.fields.name')} value={skill.name} />
              <DetailField
                label={t('skills.detail.fields.source')}
                value={
                  skill.installed ? t('skills.source.localInstall') : t('skills.source.scanned')
                }
              />
              <DetailField
                label={t('skills.detail.fields.model')}
                value={skill.modelRef ?? t('skills.detail.values.none')}
              />
              <DetailField
                label={t('skills.detail.fields.license')}
                value={skill.license ?? t('skills.detail.values.none')}
              />
              <DetailField
                label={t('skills.detail.fields.allowedTools')}
                value={skill.allowedTools?.join(', ') ?? t('skills.detail.values.allTools')}
              />
              <DetailField label={t('skills.detail.fields.path')} value={skill.skillDir} />
            </dl>
          </DetailCard>

          <DetailCard
            icon={FileText}
            title={t('skills.detail.body.title')}
            bodyClassName="border-t border-border/10"
          >
            <pre className="scrollbar-elegant max-h-[28rem] overflow-auto whitespace-pre-wrap p-3 text-xs leading-5 text-foreground/90">
              {skill.body || t('skills.detail.body.empty')}
            </pre>
          </DetailCard>
        </div>
      </div>
    </EntityDetailScaffold>
  )
}
