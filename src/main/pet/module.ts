import { readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Dirent } from 'node:fs'
import { app, ipcMain, type IpcMain } from 'electron'
import { z } from 'zod'
import { PET_CHANNELS, type CodexPetManifest, type PetAsset, type PetSummary } from '@shared/pet'
import { createLogger } from '../logger'

const log = createLogger('pet.assets')

const MANIFEST_FILE = 'pet.json'
const SPRITESHEET_FILE = 'spritesheet.webp'

const manifestSchema = z.object({
  id: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  description: z.string(),
  spritesheetPath: z.literal(SPRITESHEET_FILE)
})

function isSafeId(id: string): boolean {
  return id.length > 0 && !id.includes('/') && !id.includes('\\') && !id.includes('..')
}

function defaultPetRoots(): string[] {
  const userRoots = [join(homedir(), '.tanzo', 'pets'), join(homedir(), '.codex', 'pets')]
  const appPath = app.getAppPath()
  const resourcesPath = process.resourcesPath
  return [
    ...userRoots,
    join(appPath, 'resources', 'pets'),
    join(resourcesPath, 'resources', 'pets'),
    join(resourcesPath, 'app.asar.unpacked', 'resources', 'pets')
  ]
}

function normalizeManifest(id: string, raw: unknown): CodexPetManifest {
  const parsed = manifestSchema.parse(raw)
  if (parsed.id !== id) throw new Error(`pet id must match folder name: ${id}`)
  return parsed
}

async function readManifest(root: string, id: string): Promise<CodexPetManifest> {
  const raw = await readFile(join(root, id, MANIFEST_FILE), 'utf-8')
  return normalizeManifest(id, JSON.parse(raw))
}

async function readSpritesheet(root: string, id: string): Promise<Buffer> {
  return readFile(join(root, id, SPRITESHEET_FILE))
}

export interface PetAssetsModule {
  registerIpc(target?: IpcMain): void
  list(): Promise<PetSummary[]>
  get(id: string): Promise<PetAsset | null>
}

export interface PetAssetsModuleOptions {
  roots?: string[]
}

export function createPetAssetsModule(options: PetAssetsModuleOptions = {}): PetAssetsModule {
  const roots = options.roots ?? defaultPetRoots()

  async function list(): Promise<PetSummary[]> {
    const summaries: PetSummary[] = []
    const seen = new Set<string>()

    for (const root of roots) {
      let entries: Dirent[]
      try {
        entries = await readdir(root, { withFileTypes: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        log.error('failed to read pets directory', { root, error })
        continue
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || !isSafeId(entry.name) || seen.has(entry.name)) continue
        try {
          const manifest = await readManifest(root, entry.name)
          await readSpritesheet(root, entry.name)
          summaries.push({
            id: manifest.id,
            displayName: manifest.displayName,
            description: manifest.description
          })
          seen.add(entry.name)
        } catch (error) {
          log.warn('skipping invalid pet manifest', { root, id: entry.name, error: String(error) })
        }
      }
    }

    return summaries
  }

  async function get(id: string): Promise<PetAsset | null> {
    if (!isSafeId(id)) return null
    for (const root of roots) {
      try {
        const manifest = await readManifest(root, id)
        const buffer = await readSpritesheet(root, id)
        const spritesheetDataUrl = `data:image/webp;base64,${buffer.toString('base64')}`
        return { manifest, spritesheetDataUrl }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          log.warn('failed to load pet asset from directory', { root, id, error: String(error) })
        }
      }
    }
    log.error('failed to load pet asset', { id })
    return null
  }

  return {
    list,
    get,
    registerIpc(target: IpcMain = ipcMain) {
      target.removeHandler(PET_CHANNELS.list)
      target.removeHandler(PET_CHANNELS.get)
      target.handle(PET_CHANNELS.list, () => list())
      target.handle(PET_CHANNELS.get, (_event, id: unknown) => get(z.string().parse(id)))
    }
  }
}
