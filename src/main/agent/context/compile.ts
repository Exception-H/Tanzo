import type { ModelMessage, SystemModelMessage } from 'ai'
import type {
  BuildInput,
  CompiledContext,
  ContextMessageProvenance,
  ContextSection,
  ContextSectionProvenance,
  Stability
} from './section'

interface Rendered {
  section: ContextSection
  text: string
}

async function renderAll(registry: ContextSection[], input: BuildInput): Promise<Rendered[]> {
  const results = await Promise.all(
    registry.map(async (section) => {
      const text = await section.render(input)
      return text == null || text.length === 0 ? null : { section, text }
    })
  )
  return results.filter((r): r is Rendered => r !== null)
}

function bySection(rendered: Rendered[], stability: Stability): Rendered[] {
  return rendered
    .filter((r) => r.section.stability === stability)
    .sort((a, b) => a.section.order - b.section.order)
}

function sectionProvenance(rendered: Rendered): ContextSectionProvenance {
  return {
    sectionId: rendered.section.id,
    stability: rendered.section.stability,
    channel: rendered.section.channel
  }
}

function messageProvenance(rendered: Rendered[]): ContextMessageProvenance[] {
  return rendered.length
    ? [
        {
          sections: rendered.map(sectionProvenance)
        }
      ]
    : []
}

export async function compileSections(
  registry: ContextSection[],
  input: BuildInput,
  history: ModelMessage[]
): Promise<CompiledContext> {
  const rendered = await renderAll(registry, input)
  const stable = bySection(rendered, 'stable')
  const volatile = bySection(rendered, 'volatile')

  const stableSystem = stable.filter((r) => r.section.channel === 'system')
  const volatileSystem = volatile.filter((r) => r.section.channel === 'system')
  const system: SystemModelMessage[] = [...stableSystem, ...volatileSystem].map((r) => ({
    role: 'system',
    content: r.text
  }))

  const stableLeading = stable.filter((r) => r.section.channel === 'leading-user')
  const volatileLeading = volatile.filter((r) => r.section.channel === 'leading-user')
  const volatilePrefixLeading = volatileLeading.filter(
    (r) => r.section.prefixCacheScope === 'conversation'
  )
  const volatileTrailing = volatileLeading.filter(
    (r) => r.section.prefixCacheScope !== 'conversation'
  )
  const leadingUser: ModelMessage[] = stableLeading.length
    ? [{ role: 'user', content: stableLeading.map((r) => r.text).join('\n\n') }]
    : []
  const volatilePrefixUser: ModelMessage[] = volatilePrefixLeading.length
    ? [{ role: 'user', content: volatilePrefixLeading.map((r) => r.text).join('\n\n') }]
    : []
  const trailingUser: ModelMessage[] = volatileTrailing.length
    ? [{ role: 'user', content: volatileTrailing.map((r) => r.text).join('\n\n') }]
    : []

  return {
    system,
    stableBoundary: stableSystem.length,
    leadingUser,
    volatilePrefixUser,
    trailingUser,
    history,
    provenance: {
      system: [...stableSystem, ...volatileSystem].map(sectionProvenance),
      leadingUser: messageProvenance(stableLeading),
      volatilePrefixUser: messageProvenance(volatilePrefixLeading),
      history: history.map(() => undefined),
      trailingUser: messageProvenance(volatileTrailing)
    }
  }
}
