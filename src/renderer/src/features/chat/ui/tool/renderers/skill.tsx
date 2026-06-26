import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { TanzoTools, ToolError } from '@shared/agent-message'
import { PANEL_HEIGHT_LG } from '../primitives/constants'
import { ShimmerText } from '../primitives/shimmer'
import { ToolBadge, ToolHeaderRow } from '../primitives/header'
import { ToolPathLine, ToolScrollPanel } from '../primitives/panel'
import type { ToolRenderContext } from '../render-context'
import type { ToolRenderer } from '../renderer-types'
import { Response } from '../../message/response'
import { renderToolError } from './render-error'
import { isToolError } from './shared'

type SkillInput = Partial<TanzoTools['skill']['input']>
type SkillOutput = Exclude<TanzoTools['skill']['output'], ToolError>

const TOOL_PREVIEW_LIMIT = 10

function SkillHeader({ context }: { context: ToolRenderContext }): React.JSX.Element {
  const { t } = useTranslation()
  const input = context.input as SkillInput | undefined
  const output = context.output
  const skill = input?.skill ?? ''
  const result = output && !isToolError(output) ? (output as SkillOutput) : null
  const tools = result?.allowedTools
  const badges = result
    ? [
        { text: t('chat.tool.skill.loaded'), tone: 'success' as const },
        {
          text: boundaryBadgeText(tools, t),
          tone: tools?.length === 0 ? ('neutral' as const) : ('info' as const)
        }
      ]
    : undefined

  return (
    <ToolHeaderRow
      icon={Sparkles}
      label={t('chat.tool.skill.label')}
      title={skill || '·'}
      state={context.state}
      badges={badges}
    />
  )
}

function SkillOutputComp({ context }: { context: ToolRenderContext }): React.JSX.Element | null {
  const { t } = useTranslation()
  const err = renderToolError(context, t('chat.tool.skill.errors.activationFailed'))
  if (err) return err

  const input = context.input as SkillInput | undefined
  const output = context.output
  if (output === undefined) return <SkillPending input={input} />

  const result = output as SkillOutput
  if (!result.instructions) return null

  return (
    <div className="space-y-1.5">
      <SkillMeta input={input} result={result} />
      <ToolScrollPanel tone="subtle" maxHeight={PANEL_HEIGHT_LG} contentClassName="px-2.5 py-2">
        <Response
          content={result.instructions}
          className="text-[0.75rem] leading-[1.6] text-foreground/85"
        />
      </ToolScrollPanel>
    </div>
  )
}

function SkillPending({ input }: { input: SkillInput | undefined }): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!input?.skill) return null
  return (
    <div className="space-y-1 px-1">
      <ShimmerText
        text={t('chat.tool.skill.loadingInstructions')}
        className="text-[0.625rem] leading-[1.5]"
      />
      {input.args ? <ToolPathLine label={t('chat.tool.skill.args')} value={input.args} /> : null}
    </div>
  )
}

function SkillMeta({
  input,
  result
}: {
  input: SkillInput | undefined
  result: SkillOutput
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="space-y-1 px-1">
      {input?.args ? <ToolPathLine label={t('chat.tool.skill.args')} value={input.args} /> : null}
      <ToolPathLine label={t('chat.tool.skill.source')} value={result.skillDir} />
      {result.allowedTools && result.allowedTools.length > 0 ? (
        <AllowedTools tools={result.allowedTools} />
      ) : null}
    </div>
  )
}

function AllowedTools({ tools }: { tools: string[] }): React.JSX.Element {
  const visibleTools = tools.slice(0, TOOL_PREVIEW_LIMIT)
  const hiddenCount = tools.length - visibleTools.length
  return (
    <div className="flex flex-wrap gap-1 px-1 text-[0.5625rem] text-muted-foreground">
      {visibleTools.map((tool) => (
        <ToolBadge key={tool} text={tool} tone="info" />
      ))}
      {hiddenCount > 0 ? <ToolBadge text={`+${hiddenCount}`} tone="neutral" /> : null}
    </div>
  )
}

function boundaryBadgeText(
  tools: SkillOutput['allowedTools'] | undefined,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (tools === undefined) return ''
  if (tools === null) return t('chat.tool.skill.allTools')
  if (tools.length === 0) return t('chat.tool.skill.noTools')
  return t('chat.tool.skill.tools', { count: tools.length })
}

export const skillRenderer: ToolRenderer = {
  Header: SkillHeader,
  Output: SkillOutputComp,
  renderWhenPending: true
}
