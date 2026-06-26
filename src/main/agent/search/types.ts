export interface SearchBackendOptions {
  dangerous?: boolean
}

export interface GrepQuery {
  pattern: string
  path?: string
  glob?: string
  noIgnore?: boolean
  mode: 'content' | 'files' | 'count'
  caseInsensitive?: boolean
  contextBefore?: number
  contextAfter?: number
  type?: string
  multiline?: boolean
  headLimit?: number
  offset?: number
}

export interface GrepMatch {
  file: string
  line: number
  text: string
}

export type GrepResult =
  | { mode: 'content'; matches: GrepMatch[]; truncated: boolean }
  | { mode: 'files'; files: string[]; truncated: boolean }
  | { mode: 'count'; count: number }

export interface GlobOptions {
  noIgnore?: boolean
  offset?: number
  limit?: number
}

export interface SearchBackend {
  glob(
    pattern: string,
    path: string | undefined,
    options: GlobOptions,
    signal?: AbortSignal
  ): Promise<{ paths: string[]; truncated: boolean }>
  grep(query: GrepQuery, signal?: AbortSignal): Promise<GrepResult>
}
