import type { ReactElement } from 'react'
import { ToolErrorState } from '../primitives'
import type { ToolRenderContext } from '../render-context'
import { isToolError } from './shared'

export function renderToolError(
  context: ToolRenderContext,
  fallback: string,
  options?: { className?: string }
): ReactElement | null {
  const className = options?.className
  if (context.state === 'output-error') {
    return (
      <ToolErrorState
        {...(className ? { className } : {})}
        message={context.errorText ?? fallback}
      />
    )
  }
  const output = context.output
  if (output !== undefined && isToolError(output)) {
    return <ToolErrorState {...(className ? { className } : {})} message={output.message} />
  }
  return null
}
