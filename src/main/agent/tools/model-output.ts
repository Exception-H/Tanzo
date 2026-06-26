import type { JSONValue } from '@ai-sdk/provider'
import type { ToolResultOutput } from '@ai-sdk/provider-utils'

export function isStructuredToolError(output: unknown): output is { error: true; message: string } {
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { error?: unknown }).error === true &&
    typeof (output as { message?: unknown }).message === 'string'
  )
}

export function toolResultToModelOutput({ output }: { output: unknown }): ToolResultOutput {
  if (isStructuredToolError(output)) return { type: 'error-text', value: output.message }
  return typeof output === 'string'
    ? { type: 'text', value: output }
    : { type: 'json', value: output as JSONValue }
}
