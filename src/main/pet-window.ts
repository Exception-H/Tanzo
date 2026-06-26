import { join, normalize, sep } from 'path'
import { fileURLToPath } from 'url'
import { BrowserWindow, ipcMain, screen, shell, type IpcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import {
  CODEX_PET_ATLAS,
  PET_CHANNELS,
  type PetMoveDelta,
  type PetPosition,
  type PetPresencePayload
} from '@shared/pet'
import { createLogger } from './logger'
import { getPreferences, patchPreferences } from './preferences'

const log = createLogger('pet.window')

const PET_CANVAS_MIN_WIDTH = 640
const PET_CANVAS_MIN_HEIGHT = 720
const PET_CANVAS_EXTRA_WIDTH = 128
const PET_CANVAS_EXTRA_HEIGHT = 320
const POLL_INTERVAL_MS = 90

function petScale(): number {
  return getPreferences().petScale
}

function petSize(): { width: number; height: number } {
  const scale = petScale()
  const area = screen.getPrimaryDisplay().workArea
  const spriteWidth = CODEX_PET_ATLAS.cellWidth * scale
  const spriteHeight = CODEX_PET_ATLAS.cellHeight * scale
  return {
    width: Math.round(
      Math.min(area.width, Math.max(PET_CANVAS_MIN_WIDTH, spriteWidth + PET_CANVAS_EXTRA_WIDTH))
    ),
    height: Math.round(
      Math.min(area.height, Math.max(PET_CANVAS_MIN_HEIGHT, spriteHeight + PET_CANVAS_EXTRA_HEIGHT))
    )
  }
}

interface HitRect {
  x: number
  y: number
  width: number
  height: number
}

let hitRect: HitRect | null = null
let dragging = false
let interactive = false
let pollTimer: ReturnType<typeof setInterval> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAllowedNavigation(url: string): boolean {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && rendererUrl) {
    try {
      return new URL(url).origin === new URL(rendererUrl).origin
    } catch {
      return false
    }
  }

  if (!url.startsWith('file://')) return false
  try {
    const target = normalize(fileURLToPath(url))
    const root = normalize(join(__dirname, '../renderer'))
    return target.startsWith(`${root}${sep}`)
  } catch {
    return false
  }
}

function clampToDisplay(position: PetPosition): PetPosition {
  const { width, height } = petSize()
  const display = screen.getDisplayMatching({
    x: position.x,
    y: position.y,
    width,
    height
  })
  const area = display.workArea
  const x = Math.min(Math.max(position.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(position.y, area.y), area.y + area.height - height)
  return { x: Math.round(x), y: Math.round(y) }
}

function defaultPosition(): PetPosition {
  const { width, height } = petSize()
  const area = screen.getPrimaryDisplay().workArea
  return {
    x: Math.round(area.x + area.width - width - 24),
    y: Math.round(area.y + area.height - height - 24)
  }
}

function resolvePosition(): PetPosition {
  const stored = getPreferences().petPosition
  return stored ? clampToDisplay(stored) : defaultPosition()
}

function setInteractive(window: BrowserWindow, next: boolean): void {
  if (next === interactive) return
  interactive = next
  window.setIgnoreMouseEvents(!next, { forward: true })
}

function cursorOverHit(window: BrowserWindow): boolean {
  const cursor = screen.getCursorScreenPoint()
  const bounds = window.getContentBounds()
  const relX = cursor.x - bounds.x
  const relY = cursor.y - bounds.y
  const rect = hitRect ?? { x: 0, y: 0, width: bounds.width, height: bounds.height }
  return (
    relX >= rect.x && relX <= rect.x + rect.width && relY >= rect.y && relY <= rect.y + rect.height
  )
}

function startPolling(window: BrowserWindow): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(() => {
    if (window.isDestroyed()) return
    if (dragging) {
      setInteractive(window, true)
      return
    }
    setInteractive(window, cursorOverHit(window))
  }, POLL_INTERVAL_MS)
  if (typeof pollTimer.unref === 'function') pollTimer.unref()
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  hitRect = null
  dragging = false
  interactive = false
}

export interface CreatePetWindowOptions {
  getPresence: () => PetPresencePayload
}

export function createPetWindow(options: CreatePetWindowOptions): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const position = resolvePosition()
  const { width, height } = petSize()

  const window = new BrowserWindow({
    width,
    height,
    x: position.x,
    y: position.y,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: process.platform !== 'darwin',
    alwaysOnTop: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    acceptFirstMouse: true,
    roundedCorners: false,
    title: 'Tanzo Pet',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: true
    }
  })

  window.setAlwaysOnTop(true, isMac ? 'screen-saver' : 'pop-up-menu')
  if (isMac) window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  window.setIgnoreMouseEvents(true, { forward: true })

  window.once('ready-to-show', () => {
    if (window.isDestroyed()) return
    window.show()
    window.webContents.send(PET_CHANNELS.presenceChanged, options.getPresence())
    startPolling(window)
  })

  window.on('closed', () => {
    stopPolling()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url)) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/pet.html`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/pet.html'))
  }

  return window
}

export function destroyPetWindow(window: BrowserWindow): void {
  stopPolling()
  if (window.isDestroyed()) return
  try {
    window.setIgnoreMouseEvents(false)
    window.setAlwaysOnTop(false)
    if (process.platform === 'darwin') {
      window.setVisibleOnAllWorkspaces(false)
    }
  } catch (error) {
    log.warn('failed to reset pet window before destroy', error)
  }
  window.destroy()
}

export function resizePetWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  const { width, height } = petSize()
  const bounds = window.getContentBounds()
  if (bounds.width === width && bounds.height === height) return
  const clamped = clampToDisplay({ x: bounds.x, y: bounds.y })
  window.setBounds({ x: clamped.x, y: clamped.y, width, height })
}

export interface PetWindowIpcDeps {
  getPet: () => BrowserWindow | null
  showMainWindow: () => void
  setActiveChatId: (chatId: string | null) => void
}

const HANDLED_CHANNELS = [
  PET_CHANNELS.setHitRect,
  PET_CHANNELS.setDragging,
  PET_CHANNELS.setActiveChatId,
  PET_CHANNELS.focusMain,
  PET_CHANNELS.move,
  PET_CHANNELS.persistPosition
] as const

export function registerPetWindowIpc(deps: PetWindowIpcDeps, target: IpcMain = ipcMain): void {
  for (const channel of HANDLED_CHANNELS) target.removeHandler(channel)

  target.handle(PET_CHANNELS.setHitRect, (_event, rect: unknown) => {
    if (!isRecord(rect)) {
      hitRect = null
      return
    }
    const { x, y, width, height } = rect as Partial<HitRect>
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      hitRect = null
      return
    }
    hitRect = { x, y, width, height }
  })

  target.handle(PET_CHANNELS.setDragging, (_event, value: unknown) => {
    dragging = value === true
  })

  target.handle(PET_CHANNELS.setActiveChatId, (_event, value: unknown) => {
    deps.setActiveChatId(typeof value === 'string' && value.trim() ? value : null)
  })

  target.handle(PET_CHANNELS.focusMain, () => {
    deps.showMainWindow()
  })

  target.handle(PET_CHANNELS.move, (_event, delta: unknown) => {
    const window = deps.getPet()
    if (!window || window.isDestroyed()) return
    if (!isRecord(delta)) return
    const { dx, dy } = delta as Partial<PetMoveDelta>
    if (typeof dx !== 'number' || typeof dy !== 'number') return
    const [x, y] = window.getPosition()
    window.setPosition(Math.round(x + dx), Math.round(y + dy))
  })

  target.handle(PET_CHANNELS.persistPosition, () => {
    const window = deps.getPet()
    if (!window || window.isDestroyed()) return
    const [x, y] = window.getPosition()
    try {
      patchPreferences({ petPosition: { x, y } })
    } catch (error) {
      log.error('failed to persist pet position', error)
    }
  })
}
