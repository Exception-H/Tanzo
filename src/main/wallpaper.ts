import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, dialog, ipcMain, net, protocol, type BrowserWindow, type IpcMain } from 'electron'
import { PREFERENCES_CHANNELS, type UserPreferences } from '@shared/preferences'
import { createLogger } from './logger'
import { getPreferences, setWallpaperAsset } from './preferences'

const log = createLogger('wallpaper')

export const WALLPAPER_SCHEME = 'tanzo-asset'
const WALLPAPER_HOST = 'wallpaper'
const WALLPAPER_DIR = 'wallpapers'
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']

function wallpaperDir(): string {
  return join(app.getPath('userData'), WALLPAPER_DIR)
}

function isSafeFileName(name: string): boolean {
  return name.length > 0 && !name.includes('/') && !name.includes('\\') && !name.includes('..')
}

export function registerWallpaperScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: WALLPAPER_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

export function registerWallpaperProtocol(): void {
  protocol.handle(WALLPAPER_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.host !== WALLPAPER_HOST) return new Response('not found', { status: 404 })
      const fileName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!isSafeFileName(fileName)) return new Response('forbidden', { status: 403 })
      const filePath = join(wallpaperDir(), fileName)
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (error) {
      log.error('failed to serve wallpaper asset', error)
      return new Response('error', { status: 500 })
    }
  })
}

async function clearWallpaperDir(): Promise<void> {
  const dir = wallpaperDir()
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  await Promise.all(entries.map((entry) => rm(join(dir, entry), { force: true })))
}

async function pickWallpaper(window: BrowserWindow | null): Promise<UserPreferences> {
  const options = {
    properties: ['openFile'] as Array<'openFile'>,
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'] }]
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  const source = result.canceled ? null : (result.filePaths[0] ?? null)
  if (!source) return getPreferences()

  const ext = extname(source).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    log.warn('rejected wallpaper with unsupported extension', { ext })
    return getPreferences()
  }

  const dir = wallpaperDir()
  await mkdir(dir, { recursive: true })
  await clearWallpaperDir()
  const fileName = `wallpaper-${Date.now()}${ext}`
  await copyFile(source, join(dir, fileName))

  return setWallpaperAsset(`${WALLPAPER_SCHEME}://${WALLPAPER_HOST}/${fileName}`)
}

async function clearWallpaper(): Promise<UserPreferences> {
  await clearWallpaperDir().catch((error) => log.error('failed to clear wallpaper dir', error))
  return setWallpaperAsset(null)
}

export function registerWallpaperIpc(
  mainWindowRef: () => BrowserWindow | null,
  target: IpcMain = ipcMain
): void {
  target.removeHandler(PREFERENCES_CHANNELS.setWallpaper)
  target.removeHandler(PREFERENCES_CHANNELS.clearWallpaper)
  target.handle(PREFERENCES_CHANNELS.setWallpaper, () => pickWallpaper(mainWindowRef()))
  target.handle(PREFERENCES_CHANNELS.clearWallpaper, () => clearWallpaper())
}
