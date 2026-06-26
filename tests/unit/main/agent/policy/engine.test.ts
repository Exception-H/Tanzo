import { describe, expect, it } from 'vitest'
import type { PermissionMode, PolicyRule, PolicyUserDecision } from '@shared/policy'
import type { PolicyDecisionInput, PolicyStore, ToolPolicyKind } from '@main/agent/policy/types'
import { createPolicyEngine, fingerprint } from '@main/agent/policy/engine'

function policyStore(
  rules: PolicyRule[] = [],
  decisions: PolicyUserDecision[] = [],
  modes: Array<{ chatId: string; mode: PermissionMode }> = []
): PolicyStore {
  return {
    listRules: () => rules,
    saveRule: (rule) => ({ ...rule, source: 'user' }),
    deleteRule: () => undefined,
    listDecisions: () => decisions,
    saveDecision: (decision) => decisions.push(decision),
    revokeDecision: () => undefined,
    listModes: () => modes,
    saveMode: (chatId, mode) => {
      const existing = modes.find((entry) => entry.chatId === chatId)
      if (existing) existing.mode = mode
      else modes.push({ chatId, mode })
    }
  }
}

function decisionInput(
  toolName: string,
  input: unknown,
  options: { kind?: ToolPolicyKind; mode?: PermissionMode; chatId?: string } = {}
): PolicyDecisionInput {
  return {
    toolCall: { toolName, input, ...(options.kind ? { kind: options.kind } : {}) },
    messages: [],
    runtimeContext: { mode: options.mode, chatId: options.chatId }
  }
}

describe('main/agent/policy', () => {
  it('creates stable fingerprints independent of object key order', () => {
    expect(fingerprint('shell', { b: 2, a: 1 })).toBe(fingerprint('shell', { a: 1, b: 2 }))
    expect(fingerprint('fileEdit', { path: 'a.ts', oldText: 'x' }, ['path'])).toBe(
      fingerprint('fileEdit', { path: 'a.ts', oldText: 'y' }, ['path'])
    )
  })

  it('denies built-in dangerous paths and destructive shell commands before other rules', () => {
    const engine = createPolicyEngine({ policyStore: policyStore() })

    expect(engine.decide(decisionInput('fileRead', { path: '/repo/.git/config' }))).toMatchObject({
      type: 'denied'
    })
    expect(engine.decide(decisionInput('fileRead', { path: '/repo/.git' }))).toMatchObject({
      type: 'denied'
    })
    expect(
      engine.decide(decisionInput('shell', { command: 'rm -rf /' }, { mode: 'dangerous' }))
    ).toMatchObject({
      type: 'denied'
    })
    expect(
      engine.decide(decisionInput('shellStart', { command: 'rm -rf /' }, { mode: 'dangerous' }))
    ).toMatchObject({
      type: 'denied'
    })
    expect(
      engine.decide(
        decisionInput('shellWrite', { input: 'mkfs.ext4 /dev/sdb1\n' }, { mode: 'dangerous' })
      )
    ).toMatchObject({
      type: 'denied'
    })
    expect(
      engine.decide(decisionInput('shell', { command: 'rm -rf / --no-preserve-root' }))
    ).toMatchObject({ type: 'denied' })
    expect(
      engine.decide(decisionInput('shell', { command: 'sudo dd if=in.iso of=/dev/sda bs=4M' }))
    ).toMatchObject({ type: 'denied' })
    expect(engine.decide(decisionInput('shell', { command: 'mkfs.ext4 /dev/sdb1' }))).toMatchObject(
      { type: 'denied' }
    )
    expect(
      engine.decide(decisionInput('shell', { command: 'cat /dev/zero > /dev/sda' }))
    ).toMatchObject({ type: 'denied' })
  })

  it('still allows ordinary shell commands that resemble dangerous ones', () => {
    const engine = createPolicyEngine({ policyStore: policyStore(), initialMode: 'yolo' })

    expect(engine.decide(decisionInput('shell', { command: 'rm -rf node_modules' }))).toBe(
      'approved'
    )
    expect(engine.decide(decisionInput('shell', { command: 'rm -rf ./build' }))).toBe('approved')
    expect(engine.decide(decisionInput('shell', { command: 'rm -rf dist' }))).toBe('approved')
    expect(engine.decide(decisionInput('shell', { command: 'dd if=a.img of=b.img' }))).toBe(
      'approved'
    )
    expect(engine.decide(decisionInput('shell', { command: 'echo hi > out.txt' }))).toBe('approved')
    expect(engine.decide(decisionInput('shell', { command: 'cat README.md' }))).toBe('approved')
    expect(engine.decide(decisionInput('shell', { command: 'cat src/env.ts' }))).toBe('approved')
  })

  it('denies destructive shell variants that evade naive matching', () => {
    const engine = createPolicyEngine({ policyStore: policyStore(), initialMode: 'dangerous' })
    const denied = (command: string): unknown => engine.decide(decisionInput('shell', { command }))

    for (const command of [
      'rm -r -f /',
      'rm --recursive --force /',
      'rm -R -f ~',
      'rm -rf "$HOME"',
      'rm -rf ${HOME}',
      'rm -rf "/etc"',
      'rm -rf ..',
      'rm -rf ../',
      'rm -rf ./*',
      'rm -fr ./*',
      'rm -rf ../*'
    ]) {
      expect(denied(command), command).toMatchObject({ type: 'denied' })
    }

    for (const command of [
      'cat ~/.ssh/id_rsa',
      'cat .env',
      'cat .envrc',
      'less ~/.aws/credentials',
      'base64 .ssh/id_ed25519'
    ]) {
      expect(denied(command), command).toMatchObject({ type: 'denied' })
    }

    for (const command of [
      'dd if=/dev/zero of=/dev/rdisk0',
      'dd of="/dev/sda"',
      'echo x >> /dev/sda',
      'cat f > /dev/rdisk0'
    ]) {
      expect(denied(command), command).toMatchObject({ type: 'denied' })
    }

    expect(denied('function bomb { bomb|bomb& }; bomb')).toMatchObject({ type: 'denied' })
  })

  it('allows built-in read-only tools without approval', () => {
    const engine = createPolicyEngine({ policyStore: policyStore() })

    expect(engine.decide(decisionInput('grep', { pattern: 'x' }))).toBe('approved')
    expect(engine.decide(decisionInput('subagentCheck', { agentId: 'a1' }))).toBe('not-applicable')
  })

  it('uses permission modes for writes and unknown tools', () => {
    const engine = createPolicyEngine({ policyStore: policyStore(), initialMode: 'default' })

    expect(engine.decide(decisionInput('fileWrite', { path: 'a.ts' }))).toBe('user-approval')
    expect(engine.decide(decisionInput('shell', { cmd: 'echo hi' }, { mode: 'plan' }))).toEqual({
      type: 'denied',
      reason: 'plan mode: writes are blocked'
    })
    expect(engine.decide(decisionInput('shell', { cmd: 'echo hi' }, { mode: 'yolo' }))).toBe(
      'approved'
    )
    expect(engine.decide(decisionInput('shell', { cmd: 'echo hi' }, { mode: 'dangerous' }))).toBe(
      'approved'
    )
  })

  it('honors user rules and remembered decisions', () => {
    const rules: PolicyRule[] = [
      {
        id: 'u.ask-shell',
        source: 'user',
        scope: 'project',
        action: 'ask',
        priority: 10,
        match: { toolName: 'shell', argMatch: { path: 'command', regex: '^git ' } }
      }
    ]
    const store = policyStore(rules)
    const engine = createPolicyEngine({ policyStore: store })
    const fp = fingerprint('shell', { command: 'git status' }, ['command'])

    expect(engine.decide(decisionInput('shell', { command: 'git status' }))).toBe('user-approval')

    engine.remember({
      toolName: 'shell',
      inputFingerprint: fp,
      decision: 'approved',
      scope: 'session',
      decidedAt: 1
    })
    expect(engine.decide(decisionInput('shell', { command: 'git status' }))).toBe('approved')
  })

  it('scopes remembered decisions to the deciding workspace', () => {
    const store = policyStore([
      {
        id: 'u.ask-shell',
        source: 'user',
        scope: 'project',
        action: 'ask',
        priority: 10,
        match: { toolName: 'shell', argMatch: { path: 'command', regex: '^git ' } }
      }
    ])
    const workspaces: Record<string, string> = { 'chat-a': 'ws-a', 'chat-b': 'ws-b' }
    const engine = createPolicyEngine({
      policyStore: store,
      resolveScopeTarget: (chatId) => workspaces[chatId]
    })

    engine.remember(
      {
        toolName: 'shell',
        inputFingerprint: fingerprint('shell', { command: 'git push' }, ['command']),
        decision: 'approved',
        scope: 'forever',
        decidedAt: 1
      },
      'chat-a'
    )

    expect(
      engine.decide(decisionInput('shell', { command: 'git push' }, { chatId: 'chat-a' }))
    ).toBe('approved')
    expect(
      engine.decide(decisionInput('shell', { command: 'git push' }, { chatId: 'chat-b' }))
    ).toBe('user-approval')
  })

  it('applies legacy unscoped decisions across all workspaces', () => {
    const store = policyStore(
      [],
      [
        {
          toolName: 'shell',
          inputFingerprint: fingerprint('shell', { command: 'ls' }, ['command']),
          decision: 'approved',
          scope: 'forever',
          decidedAt: 1
        }
      ]
    )
    const engine = createPolicyEngine({
      policyStore: store,
      resolveScopeTarget: (chatId) => (chatId === 'chat-a' ? 'ws-a' : 'ws-b')
    })
    expect(engine.decide(decisionInput('shell', { command: 'ls' }, { chatId: 'chat-a' }))).toBe(
      'approved'
    )
    expect(engine.decide(decisionInput('shell', { command: 'ls' }, { chatId: 'chat-b' }))).toBe(
      'approved'
    )
  })

  it('blocks writes in plan mode even when a prior decision is remembered', () => {
    const engine = createPolicyEngine({ policyStore: policyStore() })
    const fp = fingerprint('fileWrite', { path: 'a.ts' }, ['path'])

    engine.remember({
      toolName: 'fileWrite',
      inputFingerprint: fp,
      decision: 'approved',
      scope: 'session',
      decidedAt: 1
    })

    expect(engine.decide(decisionInput('fileWrite', { path: 'a.ts' }, { kind: 'edit' }))).toBe(
      'approved'
    )
    expect(
      engine.decide(decisionInput('fileWrite', { path: 'a.ts' }, { kind: 'edit', mode: 'plan' }))
    ).toEqual({ type: 'denied', reason: 'plan mode: writes are blocked' })
  })

  it('always routes exitPlanMode to user approval across modes', () => {
    const engine = createPolicyEngine({ policyStore: policyStore() })

    expect(engine.decide(decisionInput('exitPlanMode', { plan: 'p' }, { mode: 'plan' }))).toBe(
      'user-approval'
    )
    expect(engine.decide(decisionInput('exitPlanMode', { plan: 'p' }, { mode: 'default' }))).toBe(
      'user-approval'
    )
    expect(engine.decide(decisionInput('exitPlanMode', { plan: 'p' }, { mode: 'yolo' }))).toBe(
      'user-approval'
    )
    expect(engine.decide(decisionInput('exitPlanMode', { plan: 'p' }, { mode: 'dangerous' }))).toBe(
      'user-approval'
    )
  })

  it('restores persisted chat modes and writes mode changes through to the store', () => {
    const modes: Array<{ chatId: string; mode: PermissionMode }> = [
      { chatId: 'chat-1', mode: 'plan' }
    ]
    const engine = createPolicyEngine({ policyStore: policyStore([], [], modes) })

    expect(engine.getMode('chat-1')).toBe('plan')
    expect(engine.getMode('chat-2')).toBe('default')

    engine.setMode('yolo', 'chat-1')
    engine.setMode('dangerous', 'chat-2')
    expect(modes).toEqual([
      { chatId: 'chat-1', mode: 'yolo' },
      { chatId: 'chat-2', mode: 'dangerous' }
    ])

    engine.setMode('plan')
    expect(modes).toHaveLength(2)
    expect(engine.getMode()).toBe('plan')
  })

  it('keeps the in-memory mode when persisting the mode fails', () => {
    const store = policyStore()
    store.saveMode = () => {
      throw new Error('disk full')
    }
    const engine = createPolicyEngine({ policyStore: store })

    engine.setMode('yolo', 'chat-1')
    expect(engine.getMode('chat-1')).toBe('yolo')
  })
})
