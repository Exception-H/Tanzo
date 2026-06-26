import { tool, zodSchema } from 'ai'
import { TanzoError } from '@shared/errors'
import type { TanzoTools } from '@shared/agent-message'
import type { GrepQuery } from '../../search/types'
import type { ToolDeps } from '../types'
import { toolResultToModelOutput } from '../model-output'
import { grepInputSchema } from '../tool-schemas'

const GREP_HEAD = 50

export const grepTool = (deps: ToolDeps) =>
  tool<TanzoTools['grep']['input'], TanzoTools['grep']['output'], Record<string, unknown>>({
    description:
      'Search file contents with ripgrep regex. Relative directories resolve inside the workspace; ' +
      'absolute directories outside the workspace require dangerous mode. Use mode "content" for matching ' +
      'lines, "files" to identify paths before reading, and "count" to size a search. Prefer narrow ' +
      'directory/includeGlob filters and small context windows. Gitignored files are omitted unless ' +
      'includeIgnored is true.',
    inputSchema: zodSchema(grepInputSchema),
    metadata: { tanzo: { kind: 'search', component: 'MatchCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute(input, { abortSignal }): Promise<TanzoTools['grep']['output']> {
      const query: GrepQuery = {
        pattern: input.pattern,
        mode: input.mode ?? 'content',
        headLimit: input.limit ?? GREP_HEAD,
        ...(input.directory !== undefined ? { path: input.directory } : {}),
        ...(input.includeGlob !== undefined ? { glob: input.includeGlob } : {}),
        ...(input.includeIgnored !== undefined ? { noIgnore: input.includeIgnored } : {}),
        ...(input.caseInsensitive !== undefined ? { caseInsensitive: input.caseInsensitive } : {}),
        ...(input.contextBefore !== undefined ? { contextBefore: input.contextBefore } : {}),
        ...(input.contextAfter !== undefined ? { contextAfter: input.contextAfter } : {}),
        ...(typeof input.type === 'string' ? { type: input.type } : {}),
        ...(input.multiline !== undefined ? { multiline: input.multiline } : {}),
        ...(input.offset !== undefined ? { offset: input.offset } : {})
      }
      try {
        return await deps.search.grep(query, abortSignal)
      } catch (error) {
        if (abortSignal?.aborted) throw error

        if (error instanceof TanzoError && !error.recoverable) throw error
        return { error: true, message: error instanceof Error ? error.message : String(error) }
      }
    }
  })
