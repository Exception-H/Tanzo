import { FILE_MENTION_CHANNELS, type FileMentionApi } from '@shared/file-mention'
import { invoke } from './invoke'

export const fileMentionApi: FileMentionApi = {
  search: invoke<FileMentionApi['search']>(FILE_MENTION_CHANNELS.search)
}
