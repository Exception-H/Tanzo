import type { ToolRenderContext } from './render-context'

export interface ToolRenderer {
  Header?: React.ComponentType<{ context: ToolRenderContext }>

  Output?: React.ComponentType<{ context: ToolRenderContext }>

  Footer?: React.ComponentType<{ context: ToolRenderContext }>

  renderWhenPending?: boolean

  fullBleed?: boolean
}

export type BoundRenderer = ToolRenderer
