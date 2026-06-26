import type { ToolError } from '@shared/agent-message'

export const toolError = (message: string): ToolError => ({ error: true, message })

export function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === code
}
