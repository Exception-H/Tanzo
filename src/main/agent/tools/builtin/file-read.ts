import { basename, dirname, extname } from 'node:path'
import { tool, zodSchema } from 'ai'
import type { TanzoTools } from '@shared/agent-message'
import type { ToolDeps } from '../types'
import { truncateHead } from '../text-output'
import { isErrno, toolError } from './shared'
import { fileReadInputSchema } from '../tool-schemas'

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000
const MAX_LINE_WIDTH = 2000
const MAX_OUTPUT_CHARS = 60_000
const MAX_TEXT_BYTES = 50 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const IMAGE_MEDIA: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

type FileReadOutput = TanzoTools['fileRead']['output']

async function suggestPath(deps: ToolDeps, path: string, signal?: AbortSignal): Promise<string> {
  try {
    const dir = dirname(path)
    const base = basename(path)
    const entries = await deps.fs.readDir(dir === '.' ? '' : dir, signal)
    const stem = base.replace(/\.[^.]+$/, '').toLowerCase()
    const hit =
      entries.find((e) => e.toLowerCase() === base.toLowerCase()) ??
      entries.find((e) => e.replace(/\.[^.]+$/, '').toLowerCase() === stem)
    if (!hit) return ''
    return ` Did you mean ${dir && dir !== '.' ? `${dir}/` : ''}${hit}?`
  } catch {
    return ''
  }
}

interface NotebookCell {
  cell_type?: string
  source?: string | string[]
  outputs?: Array<{
    output_type?: string
    text?: string | string[]
    data?: Record<string, string | string[]>
  }>
}

function joinSource(src: string | string[] | undefined): string {
  if (Array.isArray(src)) return src.join('')
  return src ?? ''
}

function flattenNotebook(content: string): FileReadOutput {
  let nb: { cells?: NotebookCell[] }
  try {
    nb = JSON.parse(content) as { cells?: NotebookCell[] }
  } catch {
    return toolError('Invalid notebook JSON.')
  }
  const cells = nb.cells ?? []
  const blocks = cells.map((cell, i) => {
    const src = joinSource(cell.source)
    if (cell.cell_type === 'markdown') return `#%% [markdown ${i + 1}]\n${src}`
    const outputs = (cell.outputs ?? [])
      .map((o) => {
        if (o.text) return joinSource(o.text)
        const plain = o.data?.['text/plain']
        return plain ? joinSource(plain) : ''
      })
      .filter(Boolean)
      .join('\n')
    const body = `#%% [code ${i + 1}]\n${src}`
    return outputs ? `${body}\n#%% [output]\n${outputs}` : body
  })
  const { text, truncated } = truncateHead(blocks.join('\n\n'), MAX_OUTPUT_CHARS)
  return { kind: 'notebook', content: text, cells: cells.length, truncated }
}

export const fileReadTool = (deps: ToolDeps) =>
  tool<TanzoTools['fileRead']['input'], TanzoTools['fileRead']['output'], Record<string, unknown>>({
    description:
      'Read a line-numbered window from a file. Relative paths resolve inside the workspace; absolute ' +
      'paths outside the workspace require dangerous mode. Use grep/glob first when you need to ' +
      `locate code, then read the smallest useful range. Defaults to ${DEFAULT_LIMIT} lines from ` +
      `line 1; lineCount is capped at ${MAX_LIMIT}. Avoid paging through whole files unless the ` +
      'user explicitly asks for complete contents. Images and Jupyter notebooks are read natively.',
    inputSchema: zodSchema(fileReadInputSchema),
    metadata: { tanzo: { kind: 'read', component: 'FileCard' } },
    async execute(
      { path, startLine = 1, lineCount: rawLineCount = DEFAULT_LIMIT },
      { abortSignal }
    ): Promise<FileReadOutput> {
      const lineCount = Math.min(rawLineCount, MAX_LIMIT)
      const ext = extname(path).toLowerCase()

      let info: { size: number; isFile: boolean }
      try {
        info = await deps.fs.stat(path, abortSignal)
      } catch (error) {
        if (isErrno(error, 'ENOENT')) {
          return toolError(`File not found: ${path}.${await suggestPath(deps, path, abortSignal)}`)
        }
        throw error
      }
      if (!info.isFile)
        return toolError(`Not a regular file: ${path}. Use glob to list a directory.`)

      const mediaType = IMAGE_MEDIA[ext]
      if (mediaType) {
        if (info.size > MAX_IMAGE_BYTES) {
          return toolError(`Image too large (${info.size} bytes). Maximum is ${MAX_IMAGE_BYTES}.`)
        }
        const buf = await deps.fs.readBinary(path, abortSignal)
        return { kind: 'image', data: buf.toString('base64'), mediaType, bytes: buf.length }
      }

      if (ext === '.ipynb') {
        if (info.size > MAX_TEXT_BYTES) {
          return toolError(
            `Notebook too large (${info.size} bytes) to read. Use targeted shell/search tools.`
          )
        }
        const { content } = await deps.fs.readTextMeta(path, abortSignal)
        if (content.includes('\u0000')) {
          return toolError('Binary file; not a UTF-8 text file. Use shell to inspect.')
        }
        return flattenNotebook(content)
      }

      const window = await deps.fs.readTextWindow(
        path,
        {
          offset: startLine,
          limit: lineCount,
          maxLineWidth: MAX_LINE_WIDTH,
          maxOutputChars: MAX_OUTPUT_CHARS
        },
        abortSignal
      )
      if (window.containsNul)
        return toolError('Binary file; not a UTF-8 text file. Use shell to inspect.')

      const body = window.lines.map((ln, i) => `${startLine + i}\t${ln}`).join('\n')
      const { text, truncated: charTruncated } = truncateHead(body, MAX_OUTPUT_CHARS)
      return {
        content: text,
        totalLines: window.totalLines,
        totalLinesKnown: window.totalLinesKnown,
        hasMore: window.hasMore,
        truncated: charTruncated || window.truncated || window.hasMore
      }
    },
    toModelOutput({ output }) {
      if ('error' in output) return { type: 'error-text', value: output.message }
      if ('kind' in output && output.kind === 'image') {
        return {
          type: 'content',
          value: [{ type: 'file-data', data: output.data, mediaType: output.mediaType }]
        }
      }
      const note =
        output.truncated || ('hasMore' in output && output.hasMore)
          ? '\n\n[Output truncated. Use startLine/lineCount to read more.]'
          : ''
      return { type: 'text', value: output.content + note }
    }
  })
