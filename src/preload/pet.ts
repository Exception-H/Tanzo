import { PET_CHANNELS, type PetApi, type PetPresencePayload } from '@shared/pet'
import { invoke, subscribe } from './invoke'

export const petApi: PetApi = {
  list: invoke<PetApi['list']>(PET_CHANNELS.list),
  get: invoke<PetApi['get']>(PET_CHANNELS.get),
  setHitRect: invoke<PetApi['setHitRect']>(PET_CHANNELS.setHitRect),
  setDragging: invoke<PetApi['setDragging']>(PET_CHANNELS.setDragging),
  setActiveChatId: invoke<PetApi['setActiveChatId']>(PET_CHANNELS.setActiveChatId),
  focusMain: invoke<PetApi['focusMain']>(PET_CHANNELS.focusMain),
  move: invoke<PetApi['move']>(PET_CHANNELS.move),
  persistPosition: invoke<PetApi['persistPosition']>(PET_CHANNELS.persistPosition),
  onPresenceChanged: (callback) =>
    subscribe<PetPresencePayload>(PET_CHANNELS.presenceChanged, callback)
}

export type PetPreloadApi = typeof petApi
