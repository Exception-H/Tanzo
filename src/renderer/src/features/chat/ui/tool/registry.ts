import type { ToolRenderContext } from './render-context'
import type { ToolRenderer } from './renderer-types'

class ToolRendererRegistry {
  private byName = new Map<string, ToolRenderer>()
  private byComponent = new Map<string, ToolRenderer>()
  private dynamicHandlers = new Map<string, ToolRenderer>()

  register(name: string, renderer: ToolRenderer): void {
    this.byName.set(name, renderer)
  }

  registerMany(entries: Record<string, ToolRenderer>): void {
    for (const [name, renderer] of Object.entries(entries)) {
      this.register(name, renderer)
    }
  }

  registerComponents(entries: Record<string, ToolRenderer>): void {
    for (const [component, renderer] of Object.entries(entries)) {
      this.byComponent.set(component, renderer)
    }
  }

  registerDynamicPrefix(prefix: string, renderer: ToolRenderer): void {
    this.dynamicHandlers.set(prefix, renderer)
  }

  resolve(context: ToolRenderContext): ToolRenderer | null {
    const exact = this.byName.get(context.toolName)
    if (exact) return exact
    const short = this.byName.get(context.shortName)
    if (short) return short
    if (context.componentHint) {
      const byHint = this.byComponent.get(context.componentHint)
      if (byHint) return byHint
    }
    if (context.isDynamic) {
      for (const [prefix, renderer] of this.dynamicHandlers) {
        if (context.toolName.startsWith(`${prefix}__`)) return renderer
      }
    }
    return null
  }

  listNames(): string[] {
    return [...this.byName.keys()]
  }
}

export const toolRendererRegistry = new ToolRendererRegistry()

export function resolveToolRenderer(context: ToolRenderContext): ToolRenderer | null {
  return toolRendererRegistry.resolve(context)
}
