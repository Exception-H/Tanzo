import { ipcRenderer, type IpcRendererEvent } from 'electron'

export function invoke<F extends (...args: never[]) => Promise<unknown>>(channel: string): F {
  return ((...args: Parameters<F>) => ipcRenderer.invoke(channel, ...args)) as F
}

export function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.off(channel, listener)
  }
}
