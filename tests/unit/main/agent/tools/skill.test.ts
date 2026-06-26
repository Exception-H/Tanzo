import { describe, expect, it, vi } from 'vitest'
import type { ToolDeps } from '@main/agent/tools/types'
import { skillTool } from '@main/agent/tools/skill'

describe('main/agent/tools/skill', () => {
  it('loads resolved skill instructions and registers the skill directory as readable', () => {
    const registerReadRoot = vi.fn()
    const deps = {
      fs: { registerReadRoot },
      skills: {
        listEnabled: vi.fn(() => [
          {
            name: 'test',
            body: 'Use this skill.',
            skillDir: '/skills/test',
            allowedTools: ['fileRead']
          }
        ])
      }
    } as unknown as ToolDeps

    const output = (skillTool(deps) as unknown as { execute: (input: unknown) => unknown }).execute(
      {
        skill: 'test',
        args: 'arg text'
      }
    )

    expect(output).toEqual({
      instructions: 'Use this skill.',
      skillDir: '/skills/test',
      args: 'arg text',
      allowedTools: ['fileRead']
    })
    expect(registerReadRoot).toHaveBeenCalledWith('/skills/test')
  })

  it('returns a structured error for unknown skills', () => {
    const deps = {
      fs: { registerReadRoot: vi.fn() },
      skills: { listEnabled: vi.fn(() => []) }
    } as unknown as ToolDeps

    expect(
      (skillTool(deps) as unknown as { execute: (input: unknown) => unknown }).execute({
        skill: 'missing'
      })
    ).toEqual({
      error: true,
      message: "Unknown skill 'missing'. See Available Skills."
    })
  })
})
