import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TanzoValidationError } from '@shared/errors'
import { createSearchBackend } from '@main/agent/search/backend'

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tanzo-search-'))
  await mkdir(join(root, '.git'))
  await mkdir(join(root, 'ignored'))
  await writeFile(join(root, '.gitignore'), 'ignored/\n')
  await writeFile(join(root, 'a.ts'), 'const todo = 1\nconst done = 2\n')
  await writeFile(join(root, 'b.md'), 'TODO item\n')
  await writeFile(join(root, '.hidden'), 'todo hidden\n')
  await writeFile(join(root, 'ignored-note.md'), 'todo ignored by file name only\n')
  await writeFile(join(root, 'ignored', 'match.txt'), 'todo ignored by gitignore\n')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('main/agent/search/backend', () => {
  it('finds files with rg --files and applies offset/cap metadata', async () => {
    const search = createSearchBackend(root)

    await expect(search.glob('*.ts', undefined, {})).resolves.toEqual({
      paths: ['a.ts'],
      truncated: false
    })
    await expect(search.glob('*', undefined, { offset: 1 })).resolves.toMatchObject({
      truncated: false
    })
  })

  it('lets glob callers control the result limit', async () => {
    const search = createSearchBackend(root)

    await expect(search.glob('*', undefined, { limit: 1 })).resolves.toMatchObject({
      paths: expect.arrayContaining([expect.any(String)]),
      truncated: true
    })
  })

  it('supports grep content, file, and count modes', async () => {
    const search = createSearchBackend(root)

    await expect(
      search.grep({ pattern: 'todo', mode: 'content', caseInsensitive: true, headLimit: 10 })
    ).resolves.toMatchObject({
      mode: 'content',
      matches: expect.arrayContaining([
        expect.objectContaining({ file: 'a.ts', line: 1, text: 'const todo = 1' })
      ])
    })
    await expect(
      search.grep({ pattern: 'todo', mode: 'files', caseInsensitive: true })
    ).resolves.toMatchObject({
      mode: 'files',
      files: expect.arrayContaining(['a.ts', 'b.md', '.hidden', 'ignored-note.md'])
    })
    await expect(
      search.grep({ pattern: 'todo', mode: 'count', caseInsensitive: true })
    ).resolves.toEqual({
      mode: 'count',
      count: 4
    })
  })

  it('includes gitignored files only when explicitly requested', async () => {
    const search = createSearchBackend(root)

    await expect(
      search.grep({ pattern: 'todo', mode: 'files', caseInsensitive: true })
    ).resolves.not.toMatchObject({
      files: expect.arrayContaining([expect.stringMatching(/^ignored[\\/]match\.txt$/)])
    })
    await expect(
      search.grep({ pattern: 'todo', mode: 'files', caseInsensitive: true, noIgnore: true })
    ).resolves.toMatchObject({
      mode: 'files',
      files: expect.arrayContaining([expect.stringMatching(/^ignored[\\/]match\.txt$/)])
    })
  })

  it('scopes searches to workspace paths and validates ripgrep type filters', async () => {
    const search = createSearchBackend(root)

    await expect(search.glob('*', '.git', {})).rejects.toMatchObject({
      code: 'SEARCH_GIT_PATH'
    })
    await expect(search.grep({ pattern: 'x', mode: 'files', path: '.git' })).rejects.toMatchObject({
      code: 'SEARCH_GIT_PATH'
    })
    await expect(search.glob('*', '../outside', {})).rejects.toThrow(TanzoValidationError)
    await expect(
      search.grep({ pattern: 'x', mode: 'content', type: 'definitely-not-a-real-rg-type' })
    ).rejects.toMatchObject({ code: 'GREP_INVALID_TYPE', recoverable: true })
  })
})
