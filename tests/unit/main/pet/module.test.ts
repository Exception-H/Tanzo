import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPetAssetsModule } from '@main/pet/module'

let root = ''
let tanzoRoot = ''
let codexRoot = ''

async function writePet(rootDir: string, id: string, displayName: string): Promise<void> {
  const dir = join(rootDir, id)
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'pet.json'),
    JSON.stringify({
      id,
      displayName,
      description: `${displayName} description`,
      spritesheetPath: 'spritesheet.webp'
    })
  )
  await writeFile(join(dir, 'spritesheet.webp'), Buffer.from(`${id}:${displayName}`))
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tanzo-pets-'))
  tanzoRoot = join(root, '.tanzo', 'pets')
  codexRoot = join(root, '.codex', 'pets')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('main/pet/module', () => {
  it('lists pets from tanzo and codex roots with tanzo taking precedence', async () => {
    await writePet(codexRoot, 'shared', 'Codex Shared')
    await writePet(codexRoot, 'legacy', 'Legacy')
    await writePet(tanzoRoot, 'shared', 'Tanzo Shared')
    await writePet(tanzoRoot, 'native', 'Native')

    const module = createPetAssetsModule({ roots: [tanzoRoot, codexRoot] })
    const pets = await module.list()

    expect(pets).toHaveLength(3)
    expect(pets).toContainEqual({
      id: 'shared',
      displayName: 'Tanzo Shared',
      description: 'Tanzo Shared description'
    })
    expect(pets).toContainEqual({
      id: 'native',
      displayName: 'Native',
      description: 'Native description'
    })
    expect(pets).toContainEqual({
      id: 'legacy',
      displayName: 'Legacy',
      description: 'Legacy description'
    })
  })

  it('loads pet assets from the codex compatibility root', async () => {
    await writePet(codexRoot, 'legacy', 'Legacy')

    const module = createPetAssetsModule({ roots: [tanzoRoot, codexRoot] })
    const asset = await module.get('legacy')

    expect(asset?.manifest.displayName).toBe('Legacy')
    expect(asset?.spritesheetDataUrl).toContain(Buffer.from('legacy:Legacy').toString('base64'))
  })

  it('loads the bundled ikkun pet from app resources', async () => {
    const module = createPetAssetsModule({ roots: [resolve('resources', 'pets')] })

    const pets = await module.list()
    const asset = await module.get('ikkun')

    expect(pets).toContainEqual({
      id: 'ikkun',
      displayName: 'ikkun',
      description: '灰色刘海、圆眼红腮、穿黑色背带裤和白色背带的团雀风数字宠物。'
    })
    expect(asset?.manifest.id).toBe('ikkun')
    expect(asset?.spritesheetDataUrl).toMatch(/^data:image\/webp;base64,/)
  })
})
