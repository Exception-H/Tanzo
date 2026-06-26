import { isDynamicToolUIPart, isToolUIPart, getToolName, type UIMessagePart } from 'ai'

export type ToolCategory = 'fs' | 'shell' | 'web' | 'agent' | 'memory' | 'plan' | 'meta'

export type ToolPaneHint = 'tool' | 'diff' | 'terminal' | 'plan' | 'memory' | 'nested' | 'inline'

export interface ToolRenderHints {
  pane: ToolPaneHint
  streaming?: boolean
  collapsible?: boolean
  nestedSession?: boolean
}

export interface ToolStaticMeta {
  category: ToolCategory
  isReadOnly: boolean
  renderHints: ToolRenderHints
}

export type ToolUIState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied'

export interface ToolRenderContext {
  toolName: string

  shortName: string

  state: ToolUIState

  isDynamic: boolean

  toolCallId: string

  input: unknown

  output?: unknown

  preliminary?: boolean

  errorText?: string

  providerMetadata?: Record<string, unknown>

  componentHint?: string

  approval?: { id: string; approved?: boolean; reason?: string; isAutomatic?: boolean }

  meta?: ToolStaticMeta
}

interface ToolPartLike {
  type: string
  state: ToolUIState
  toolCallId: string
  input?: unknown
  output?: unknown
  preliminary?: boolean
  errorText?: string
  providerExecuted?: boolean
  callProviderMetadata?: Record<string, unknown>
  providerMetadata?: Record<string, unknown>
  approval?: { id: string; approved?: boolean; reason?: string; isAutomatic?: boolean }
}

export interface BuildContextArgs {
  part: UIMessagePart<never, never>

  metaByName?: Record<string, ToolStaticMeta>
}

export function buildToolRenderContext({
  part,
  metaByName
}: BuildContextArgs): ToolRenderContext | null {
  const isStatic = isToolUIPart(part)
  const isDynamic = isDynamicToolUIPart(part)
  if (!isStatic && !isDynamic) return null

  const toolPart = part as unknown as ToolPartLike
  const fullName = getToolName(part as never)
  const shortName = stripToolPrefix(fullName)
  const providerMetadata = toolPart.callProviderMetadata ?? toolPart.providerMetadata
  const componentHint = readComponentHint(providerMetadata)
  const toolErrorMessage = readToolErrorMessage(toolPart.output)
  const errorText = toolPart.errorText ?? toolErrorMessage
  const state =
    toolPart.preliminary === true && toolPart.state === 'output-available'
      ? 'input-available'
      : toolPart.state

  const ctx: ToolRenderContext = {
    toolName: fullName,
    shortName,
    state: toolErrorMessage ? 'output-error' : state,
    isDynamic,
    toolCallId: toolPart.toolCallId,
    input: toolPart.input,
    ...(toolPart.output !== undefined ? { output: toolPart.output } : {}),
    ...(toolPart.preliminary !== undefined ? { preliminary: toolPart.preliminary } : {}),
    ...(errorText !== undefined ? { errorText } : {}),
    ...(providerMetadata ? { providerMetadata } : {}),
    ...(componentHint ? { componentHint } : {}),
    ...(toolPart.approval ? { approval: toolPart.approval } : {})
  }

  const meta = metaByName?.[fullName] ?? metaByName?.[shortName]
  if (meta) ctx.meta = meta

  return ctx
}

function readToolErrorMessage(output: unknown): string | undefined {
  if (typeof output !== 'object' || output === null) return undefined
  const record = output as { error?: unknown; message?: unknown }
  return record.error === true && typeof record.message === 'string' ? record.message : undefined
}

function readComponentHint(metadata: Record<string, unknown> | undefined): string | undefined {
  const tanzo = metadata?.tanzo
  if (typeof tanzo !== 'object' || tanzo === null) return undefined
  const component = (tanzo as { component?: unknown }).component
  return typeof component === 'string' ? component : undefined
}

export function stripToolPrefix(name: string): string {
  const segments = name.split('__')
  return segments[segments.length - 1] || name
}

export function isPendingState(state: ToolUIState): boolean {
  return (
    state === 'input-streaming' ||
    state === 'input-available' ||
    state === 'approval-requested' ||
    state === 'approval-responded'
  )
}

export function isResolvedState(state: ToolUIState): boolean {
  return state === 'output-available' || state === 'output-error' || state === 'output-denied'
}
