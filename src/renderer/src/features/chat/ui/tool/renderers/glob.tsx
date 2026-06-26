import { FileSearch } from 'lucide-react'
import type { TanzoTools, ToolError } from '@shared/agent-message'
import {
  PANEL_HEIGHT_MD,
  ToolEmptyState,
  ToolHeaderRow,
  ToolMetaLine,
  ToolMetaChip,
  ToolScrollPanel
} from '../primitives'
import type { ToolRenderContext } from '../render-context'
import type { ToolRenderer } from '../renderer-types'
import { renderToolError } from './render-error'
import { isToolError, splitDirAndFile } from './shared'

type GlobInput = Partial<TanzoTools['glob']['input']>
type GlobOutput = Exclude<TanzoTools['glob']['output'], ToolError>

function GlobHeader({ context }: { context: ToolRenderContext }): React.JSX.Element {
  const input = context.input as GlobInput | undefined
  const output = context.output
  const pattern = input?.pattern ?? ''
  const count = output && !isToolError(output) ? (output as GlobOutput).paths.length : undefined

  return (
    <ToolHeaderRow
      icon={FileSearch}
      label="Glob"
      title={pattern || '·'}
      state={context.state}
      meta={typeof count === 'number' ? <ToolMetaChip text={`${count} hits`} /> : null}
    />
  )
}

function GlobQueryMeta({ input }: { input: GlobInput | undefined }): React.JSX.Element | null {
  const parts: string[] = []
  if (input?.directory) parts.push(`dir ${input.directory}`)
  if (input?.includeIgnored) parts.push('including ignored files')
  if (typeof input?.offset === 'number' && input.offset > 0) parts.push(`offset ${input.offset}`)
  if (typeof input?.limit === 'number') parts.push(`limit ${input.limit}`)
  if (parts.length === 0) return null
  return (
    <ToolMetaLine className="border-b border-border/8 px-2.5 py-1">
      {parts.join(' · ')}
    </ToolMetaLine>
  )
}

function GlobOutputComp({ context }: { context: ToolRenderContext }): React.JSX.Element | null {
  const err = renderToolError(context, 'Glob failed.', { className: 'm-2.5' })
  if (err) return err
  const output = context.output
  if (output === undefined) return null

  const result = output as GlobOutput
  const input = context.input as GlobInput | undefined
  if (result.paths.length === 0) {
    return <ToolEmptyState className="m-2.5" message="No matching files." />
  }
  return (
    <ToolScrollPanel flush tone="subtle" maxHeight={PANEL_HEIGHT_MD}>
      <GlobQueryMeta input={input} />
      <ul className="divide-y divide-border/8">
        {result.paths.map((path) => {
          const { fileName, dir } = splitDirAndFile(path)
          return (
            <li
              key={path}
              className="flex items-center gap-1 px-2.5 py-1 font-mono text-[0.6875rem] leading-[1.4] hover:bg-background/24"
            >
              {dir && <span className="truncate text-foreground/40">{dir}/</span>}
              <span className="min-w-0 flex-1 truncate text-foreground/85">{fileName || path}</span>
            </li>
          )
        })}
      </ul>
      {result.truncated && (
        <p className="border-t border-border/10 px-2.5 py-1 text-[0.5625rem] text-muted-foreground">
          Result list was truncated. Refine the pattern or page with offset.
        </p>
      )}
    </ToolScrollPanel>
  )
}

export const globRenderer: ToolRenderer = {
  Header: GlobHeader,
  Output: GlobOutputComp,
  fullBleed: true
}
