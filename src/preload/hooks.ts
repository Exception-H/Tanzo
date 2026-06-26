import { HOOKS_CHANNELS, type HooksApi } from '@shared/hooks'
import { invoke } from './invoke'

export const hooksApi: HooksApi = {
  list: invoke<HooksApi['list']>(HOOKS_CHANNELS.list),
  reload: invoke<HooksApi['reload']>(HOOKS_CHANNELS.reload),
  setEnabled: invoke<HooksApi['setEnabled']>(HOOKS_CHANNELS.setEnabled),
  setTrusted: invoke<HooksApi['setTrusted']>(HOOKS_CHANNELS.setTrusted),
  preview: invoke<HooksApi['preview']>(HOOKS_CHANNELS.preview)
}

export type HooksPreloadApi = typeof hooksApi
