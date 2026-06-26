import { describe, expect, it } from 'vitest'
import { compileMatcher, hookContentHash, parseHooksConfig } from '@main/agent/hooks/config'

function parse(raw: unknown) {
  return parseHooksConfig({ raw, source: 'project', keySource: '/tmp/hooks.json' })
}

describe('main/agent/hooks/config', () => {
  it('parses the canonical Codex/Claude hooks.json', () => {
    const { entries, warnings } = parse({
      hooks: {
        PreToolUse: [
          {
            matcher: '^Bash$',
            hooks: [
              {
                type: 'command',
                command: 'python3 /tmp/pre.py',
                timeout: 10,
                statusMessage: 'checking'
              }
            ]
          }
        ]
      }
    })
    expect(warnings).toEqual([])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      event: 'PreToolUse',
      matcher: '^Bash$',
      command: 'python3 /tmp/pre.py',
      timeoutSec: 10,
      statusMessage: 'checking',
      source: 'project',
      key: '/tmp/hooks.json:pre_tool_use:0:0'
    })
  })

  it('defaults timeout to 600s', () => {
    const { entries } = parse({
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] }
    })
    expect(entries[0].timeoutSec).toBe(600)
  })

  it('accepts all 10 Codex events (config compatibility)', () => {
    const { entries, warnings } = parse({
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'a' }] }],
        PermissionRequest: [{ hooks: [{ type: 'command', command: 'b' }] }],
        PostToolUse: [{ hooks: [{ type: 'command', command: 'c' }] }],
        PreCompact: [{ hooks: [{ type: 'command', command: 'd' }] }],
        PostCompact: [{ hooks: [{ type: 'command', command: 'e' }] }],
        SessionStart: [{ hooks: [{ type: 'command', command: 'f' }] }],
        UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'g' }] }],
        SubagentStart: [{ hooks: [{ type: 'command', command: 'h' }] }],
        SubagentStop: [{ hooks: [{ type: 'command', command: 'i' }] }],
        Stop: [{ hooks: [{ type: 'command', command: 'j' }] }]
      }
    })
    expect(warnings).toEqual([])
    expect(entries).toHaveLength(10)
  })

  it('skips prompt/agent handlers and async with warnings', () => {
    const { entries, warnings } = parse({
      hooks: {
        PreToolUse: [
          {
            hooks: [
              { type: 'prompt' },
              { type: 'agent' },
              { type: 'command', command: 'x', async: true },
              { type: 'command', command: 'ok' }
            ]
          }
        ]
      }
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].command).toBe('ok')
    expect(warnings).toHaveLength(3)
  })

  it('rejects unknown handler fields (deny_unknown_fields)', () => {
    const { entries, warnings } = parse({
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x', bogus: 1 }] }] }
    })
    expect(entries).toHaveLength(0)
    expect(warnings[0]).toMatch(/invalid hooks config/)
  })

  it('rejects unknown top-level keys', () => {
    const { entries, warnings } = parse({ hooks: {}, extra: true })
    expect(entries).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })

  it('assigns a monotonic display order', () => {
    const { entries } = parse({
      hooks: {
        PreToolUse: [
          {
            hooks: [
              { type: 'command', command: 'a' },
              { type: 'command', command: 'b' }
            ]
          }
        ]
      }
    })
    expect(entries.map((entry) => entry.displayOrder)).toEqual([0, 1])
  })
})

describe('main/agent/hooks/config matcher semantics', () => {
  const warnings: string[] = []
  const compile = (matcher: string | null) => compileMatcher(matcher, warnings, 'test')

  it('matches everything for null/empty/star', () => {
    for (const matcher of [null, '', '*']) {
      const matches = compile(matcher)
      expect(matches('anything')).toBe(true)
    }
  })

  it('treats [A-Za-z0-9_|] as exact alternatives', () => {
    const matches = compile('Edit|Write')
    expect(matches('Edit')).toBe(true)
    expect(matches('Write')).toBe(true)
    expect(matches('MultiEdit')).toBe(false)
  })

  it('treats other matchers as regex', () => {
    const matches = compile('^Bash.*$')
    expect(matches('Bash')).toBe(true)
    expect(matches('BashTool')).toBe(true)
    expect(matches('Edit')).toBe(false)
  })

  it('an invalid regex matches nothing and warns', () => {
    const local: string[] = []
    const matches = compileMatcher('(', local, 'ctx')
    expect(matches('x')).toBe(false)
    expect(local[0]).toMatch(/invalid matcher regex/)
  })
})

describe('main/agent/hooks/config content hash', () => {
  it('is stable for the same identity and changes with the command', () => {
    const a = hookContentHash({ command: 'echo a', event: 'PreToolUse', matcher: '*' })
    const b = hookContentHash({ command: 'echo a', event: 'PreToolUse', matcher: '*' })
    const c = hookContentHash({ command: 'echo b', event: 'PreToolUse', matcher: '*' })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
