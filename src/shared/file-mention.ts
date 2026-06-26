export type FileMentionType = 'file' | 'directory'

export interface FileMentionEntry {
  path: string
  name: string
  type: FileMentionType
}

export const FILE_MENTION_CHANNELS = {
  search: 'file-mention:search'
} as const

export type FileMentionChannel = (typeof FILE_MENTION_CHANNELS)[keyof typeof FILE_MENTION_CHANNELS]

export interface FileMentionApi {
  search(workspaceRoot: string, query: string): Promise<FileMentionEntry[]>
}
