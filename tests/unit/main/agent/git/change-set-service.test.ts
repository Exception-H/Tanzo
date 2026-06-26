import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChangeSetService } from '@main/agent/git/change-set-service'

function execGit(cwd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

describe('agent/git/change-set-service', () => {
  let root: string
  let userDataPath: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tanzo-change-set-repo-'))
    userDataPath = await mkdtemp(join(tmpdir(), 'tanzo-change-set-user-data-'))
    await execGit(root, ['init'])
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(userDataPath, { recursive: true, force: true })
  })

  it('rejects restore paths outside the captured change set', { timeout: 20_000 }, async () => {
    const service = createChangeSetService({ userDataPath })
    await writeFile(join(root, 'allowed.txt'), 'before\n', 'utf8')
    await writeFile(join(root, 'unrelated.txt'), 'original\n', 'utf8')

    await service.captureBeforeRun({
      runId: 'run-1',
      chatId: 'chat-1',
      assistantMessageId: 'assistant-1',
      cwd: root
    })
    await writeFile(join(root, 'allowed.txt'), 'after\n', 'utf8')
    const preview = await service.captureAfterRun({
      runId: 'run-1',
      chatId: 'chat-1',
      assistantMessageId: 'assistant-1',
      cwd: root
    })

    expect(preview?.files.map((file) => file.path)).toEqual(['allowed.txt'])
    await writeFile(join(root, 'unrelated.txt'), 'current\n', 'utf8')

    await expect(
      service.applyChangeSet({
        changeSetId: preview!.changeSetId,
        targetState: 'before',
        paths: ['unrelated.txt']
      })
    ).rejects.toThrow('not part of this change set')
    await expect(readFile(join(root, 'unrelated.txt'), 'utf8')).resolves.toBe('current\n')
  })
})
