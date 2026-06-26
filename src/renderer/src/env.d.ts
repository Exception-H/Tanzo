/// <reference types="vite/client" />

import type { TanzoElectronAPI } from '../../preload'

declare global {
  interface Window {
    electron: TanzoElectronAPI
  }
}

export {}
