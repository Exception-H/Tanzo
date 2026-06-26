import { SLASH_COMMAND_CHANNELS, type SlashCommandApi } from '@shared/slash-command'
import { invoke } from './invoke'

export const slashCommandApi: SlashCommandApi = {
  list: invoke<SlashCommandApi['list']>(SLASH_COMMAND_CHANNELS.list)
}
