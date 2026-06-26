import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAgentIdentity } from '@main/agent/agents/index'

let roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'tanzo-agents-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  roots = []
})

describe('main/agent/agents', () => {
  it('loads workspace main agents and subagents with default model fallback', async () => {
    const workspaceRoot = await tempRoot()
    await mkdir(join(workspaceRoot, '.tanzo', 'agents'), { recursive: true })
    await mkdir(join(workspaceRoot, '.tanzo', 'subagents'), { recursive: true })
    await writeFile(
      join(workspaceRoot, '.tanzo', 'agents', 'helper.md'),
      `---
name: Unit Main
description: Main helper
---
Main prompt`
    )
    await writeFile(
      join(workspaceRoot, '.tanzo', 'subagents', 'worker.md'),
      `---
name: Unit Worker
description: Worker helper
model: anthropic:claude
---
Worker prompt`
    )
    const logger = { warn: vi.fn() }

    const identity = createAgentIdentity({
      workspaceRoot,
      defaultModelRef: () => 'openai:gpt-5',
      logger: logger as never
    })

    expect(identity.resolveAgentType('Unit Main')).toMatchObject({
      name: 'Unit Main',
      kind: 'main',
      modelRef: 'openai:gpt-5'
    })
    expect(identity.resolveAgentType('Unit Worker')).toMatchObject({
      name: 'Unit Worker',
      kind: 'subagent',
      modelRef: 'anthropic:claude'
    })
    expect(identity.listAgents('subagent').map((agent) => agent.name)).toContain('Unit Worker')
  })

  it('records parse errors without failing the whole identity registry', async () => {
    const workspaceRoot = await tempRoot()
    await mkdir(join(workspaceRoot, '.tanzo', 'agents'), { recursive: true })
    await writeFile(join(workspaceRoot, '.tanzo', 'agents', 'bad.md'), '---\nkind: nope\n---\nBody')
    const logger = { warn: vi.fn() }

    const identity = createAgentIdentity({
      workspaceRoot,
      defaultModelRef: () => 'openai:gpt-5',
      logger: logger as never
    })

    expect(identity.listLoadErrors()).toEqual([
      expect.objectContaining({ file: expect.stringContaining('bad.md') })
    ])
    expect(logger.warn).toHaveBeenCalledWith(
      'failed to load agent definition',
      expect.objectContaining({ message: expect.stringContaining('invalid kind') })
    )
  })
})
