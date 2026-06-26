import { tool, zodSchema } from 'ai'
import { TanzoError } from '@shared/errors'
import type { TanzoTools } from '@shared/agent-message'
import type { GlobOptions } from '../../search/types'
import type { ToolDeps } from '../types'
import { toolResultToModelOutput } from '../model-output'
import { globInputSchema } from '../tool-schemas'

export const globTool = (deps: ToolDeps) =>
  tool<TanzoTools['glob']['input'], TanzoTools['glob']['output'], Record<string, unknown>>({
    description:
      'Find files by glob pattern. Relative directories resolve inside the workspace; absolute ' +
      'directories outside the workspace require dangerous mode. Use this to discover candidate files ' +
      'before reading or editing. Results are newest first; hidden files are included, .git is excluded, ' +
      'and gitignored files are omitted unless includeIgnored is true.',
    inputSchema: zodSchema(globInputSchema),
    metadata: { tanzo: { kind: 'search', component: 'FileListCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute(
      { pattern, directory, includeIgnored, offset, limit },
      { abortSignal }
    ): Promise<TanzoTools['glob']['output']> {
      const options: GlobOptions = {
        ...(includeIgnored !== undefined ? { noIgnore: includeIgnored } : {}),
        ...(offset !== undefined ? { offset } : {}),
        ...(limit !== undefined ? { limit } : {})
      }
      try {
        return await deps.search.glob(pattern, directory, options, abortSignal)
      } catch (error) {
        if (abortSignal?.aborted || error instanceof TanzoError) throw error
        return { error: true, message: error instanceof Error ? error.message : String(error) }
      }
    }
  })
