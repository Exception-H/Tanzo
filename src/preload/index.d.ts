import type { TanzoElectronAPI } from './index'

declare global {
  interface Window {
    electron: TanzoElectronAPI
  }
}

export {}
