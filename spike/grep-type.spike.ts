import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSearchBackend } from '../src/main/agent/search/backend'
import { TanzoValidationError } from '../src/shared/errors'

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'grep-type-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src', 'a.ts'), 'const needle = 1\n')
  writeFileSync(join(dir, 'src', 'b.js'), 'const needle = 2\n')
  writeFileSync(join(dir, 'readme.md'), 'needle in markdown\n')
  return dir
}

test('grep type — valid ripgrep type filters to that language', async () => {
  const backend = createSearchBackend(fixture())
  const result = await backend.grep({ pattern: 'needle', mode: 'files', type: 'ts' })
  assert.equal(result.mode, 'files')
  if (result.mode !== 'files') return
  assert.deepEqual(result.files, ['src/a.ts'])
})

test('grep type — "file" is rejected with an actionable, recoverable error', async () => {
  const backend = createSearchBackend(fixture())
  await assert.rejects(
    () => backend.grep({ pattern: 'needle', mode: 'files', type: 'file' }),
    (err: unknown) => {
      assert.ok(err instanceof TanzoValidationError)
      assert.equal(err.code, 'GREP_INVALID_TYPE')
      assert.equal(err.recoverable, true)
      assert.match(err.message, /not "file"/)
      assert.match(err.message, /glob/)
      return true
    }
  )
})

test('grep type — omitting type searches all files', async () => {
  const backend = createSearchBackend(fixture())
  const result = await backend.grep({ pattern: 'needle', mode: 'files' })
  assert.equal(result.mode, 'files')
  if (result.mode !== 'files') return
  assert.equal(result.files.length, 3)
})
