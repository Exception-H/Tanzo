import { describe, it, expect } from 'vitest'
import type { ModelMessage } from 'ai'
import { compileSections } from '../src/main/agent/context/compile'
import { createContextEngine } from '../src/main/agent/context'
import type { ContextSection } from '../src/main/agent/context/section'
import { projectHistory } from '../src/main/agent/context/project'
import { strategyFor } from '../src/main/agent/context/providers'
import { createBudget, roughEstimate } from '../src/main/agent/context/budget'
import { computeCompactionPolicy } from '../src/main/agent/context/compaction-policy'
import { createCapabilities } from '../src/main/agent/context/capabilities'
import { buildPromptCacheDiagnostic } from '../src/main/agent/diagnostics/prompt-cache'

const CAP = { contextWindow: 200_000, maxOutputTokens: 8_192, supportsImages: true }

function section(
  id: string,
  stability: 'stable' | 'volatile',
  channel: 'system' | 'leading-user',
  order: number,
  text: string | null,
  prefixCacheScope?: 'conversation'
): ContextSection {
  return {
    id,
    stability,
    channel,
    order,
    ...(prefixCacheScope ? { prefixCacheScope } : {}),
    render: () => text
  }
}

const BUILD_INPUT = {
  def: { modelRef: 'anthropic:claude-opus-4-5', systemPrompt: 'role' } as never,
  cwd: '/tmp',
  capabilities: CAP
}

describe('compileSections — 行编译', () => {
  it('stable system 段在前、volatile 在后,stableBoundary 指向第一个 volatile system', async () => {
    const registry = [
      section('datetime', 'volatile', 'leading-user', 0, 'NOW', 'conversation'),
      section('role', 'stable', 'system', 0, 'ROLE'),
      section('tools', 'stable', 'system', 1, 'TOOLS'),
      section('vol-sys', 'volatile', 'system', 0, 'VOL'),
      section('git', 'volatile', 'leading-user', 1, 'GIT', 'conversation')
    ]
    const plan = await compileSections(registry, BUILD_INPUT, [])
    expect(plan.system.map((m) => m.content)).toEqual(['ROLE', 'TOOLS', 'VOL'])
    expect(plan.stableBoundary).toBe(2)
    expect(plan.leadingUser).toHaveLength(0)
    expect(plan.volatilePrefixUser).toHaveLength(1)
    expect(plan.volatilePrefixUser[0].content).toBe('NOW\n\nGIT')
    expect(plan.trailingUser).toHaveLength(0)
  })

  it('stable leading-user 在历史前, volatile leading-user 被移到历史后', async () => {
    const registry = [
      section('env', 'stable', 'leading-user', 0, 'ENV'),
      section('datetime', 'volatile', 'leading-user', 0, 'NOW', 'conversation'),
      section('git', 'volatile', 'leading-user', 1, 'GIT', 'conversation')
    ]
    const history: ModelMessage[] = [{ role: 'user', content: 'real user turn' }]
    const plan = await compileSections(registry, BUILD_INPUT, history)
    expect(
      [...plan.leadingUser, ...plan.history, ...plan.volatilePrefixUser, ...plan.trailingUser].map(
        (m) => m.content
      )
    ).toEqual(['ENV', 'real user turn', 'NOW\n\nGIT'])
  })

  it('render 返回 null 的 section 被丢弃', async () => {
    const registry = [
      section('role', 'stable', 'system', 0, 'ROLE'),
      section('git', 'volatile', 'leading-user', 0, null)
    ]
    const plan = await compileSections(registry, BUILD_INPUT, [])
    expect(plan.system).toHaveLength(1)
    expect(plan.leadingUser).toHaveLength(0)
    expect(plan.trailingUser).toHaveLength(0)
  })
})

describe('projectHistory — 投影层 normalize', () => {
  it('给孤儿 tool-call 补占位输出', () => {
    const history: ModelMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'fileRead', input: {} }]
      }
    ]
    const out = projectHistory(history, CAP)
    expect(out).toHaveLength(2)
    expect(out[1].role).toBe('tool')
  })

  it('删除孤儿 tool-result', () => {
    const history: ModelMessage[] = [
      { role: 'user', content: 'hi' },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'orphan',
            toolName: 'x',
            output: { type: 'text', value: 'v' }
          }
        ]
      }
    ]
    const out = projectHistory(history, CAP)
    expect(out).toHaveLength(1)
    expect(out[0].role).toBe('user')
  })

  it('按 tool-call 顺序规范化 tool approval/result,避免 live 与 reload 顺序漂移', () => {
    const history: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'c1', toolName: 'glob', input: {} },
          { type: 'tool-approval-request', approvalId: 'a1', toolCallId: 'c1', isAutomatic: true },
          { type: 'tool-call', toolCallId: 'c2', toolName: 'fileRead', input: {} },
          { type: 'tool-approval-request', approvalId: 'a2', toolCallId: 'c2', isAutomatic: true }
        ]
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-approval-response', approvalId: 'a1', approved: true },
          { type: 'tool-approval-response', approvalId: 'a2', approved: true },
          {
            type: 'tool-result',
            toolCallId: 'c2',
            toolName: 'fileRead',
            output: { type: 'text', value: 'file' }
          },
          {
            type: 'tool-result',
            toolCallId: 'c1',
            toolName: 'glob',
            output: { type: 'text', value: 'glob' }
          }
        ]
      }
    ]
    const out = projectHistory(history, CAP)
    expect(
      out[1].content as Array<{ type: string; toolCallId?: string; approvalId?: string }>
    ).toMatchObject([
      { type: 'tool-approval-response', approvalId: 'a1' },
      { type: 'tool-result', toolCallId: 'c1' },
      { type: 'tool-approval-response', approvalId: 'a2' },
      { type: 'tool-result', toolCallId: 'c2' }
    ])
  })

  it('保留图片，交给 provider SDK 处理支持性', () => {
    const imagePart = { type: 'image', image: 'data:...' } as never
    const history: ModelMessage[] = [{ role: 'user', content: [imagePart] }]
    const out = projectHistory(history, { ...CAP, supportsImages: false })
    expect(out[0].content).toEqual([imagePart])
  })
})

describe('strategyFor — provider 列选择', () => {
  it('anthropic: 稳定段尾打 1h、history 尾打 5m', () => {
    const strat = strategyFor('anthropic:claude-opus-4-5', 'chat-1')
    const plan = {
      system: [
        { role: 'system' as const, content: 'STABLE' },
        { role: 'system' as const, content: 'VOL' }
      ],
      stableBoundary: 1,
      leadingUser: [],
      volatilePrefixUser: [],
      trailingUser: [],
      history: [{ role: 'user' as const, content: 'last' }]
    }
    const out = strat.applyCaching(plan)
    expect(
      (out.system[0].providerOptions as never as { anthropic: { cacheControl: { ttl: string } } })
        .anthropic.cacheControl.ttl
    ).toBe('1h')
    expect(out.system[1].providerOptions).toBeUndefined()
    const tail = out.history[0] as {
      providerOptions?: { anthropic: { cacheControl: { ttl: string } } }
    }
    expect(tail.providerOptions?.anthropic.cacheControl.ttl).toBe('5m')
  })

  it('openai: 设 promptCacheKey,不打 message 断点', () => {
    const strat = strategyFor('openai:gpt-5', 'chat-9')
    const out = strat.applyCaching({
      system: [],
      stableBoundary: 0,
      leadingUser: [],
      volatilePrefixUser: [],
      trailingUser: [],
      history: []
    })
    const opts = (
      out.providerOptions as { openai: { promptCacheKey: string; promptCacheRetention: string } }
    ).openai
    expect(opts.promptCacheKey).toBe('chat-9')
    expect(opts.promptCacheRetention).toBe('24h')
  })

  it('build 只在首步把 volatile context 放到历史后方', async () => {
    const engine = createContextEngine({
      clock: { now: () => new Date('2026-06-01T00:00:00.000Z') },
      tanzoInstructions: { read: () => null },
      skillsIndex: { list: () => [] },
      gitStatus: { read: () => 'branch: main\n M file.ts' },
      toolsDoc: { read: () => null },
      goal: { peekInjection: () => null, takeInjection: () => null },
      policyMode: { getMode: () => 'default' },
      resolveModelMetadata: () => ({ contextWindow: 200_000, maxOutput: 8_192 })
    } as never)
    const def = {
      id: 'general',
      name: 'General',
      description: '',
      kind: 'main' as const,
      modelRef: 'openai:gpt-5.5',
      systemPrompt: 'ROLE',
      allowedTools: null
    }
    const transcript = [{ role: 'user' as const, content: 'hi' }]

    const first = await engine.build(def, 'chat-9', '/repo', transcript, 0)
    expect(first?.messages?.map((m) => m.role)).toEqual(['user', 'user', 'user'])
    expect(first?.messages?.[0].content).toContain('<environment>')
    expect(first?.messages?.[1].content).toBe('hi')
    expect(first?.messages?.[2].content).toContain('2026-06-01')

    const second = await engine.build(def, 'chat-9', '/repo', transcript, 1)
    expect(second?.messages?.map((m) => m.role)).toEqual(['user', 'user'])
    expect(JSON.stringify(second?.messages)).not.toContain('<datetime>')
  })

  it('deepseek: applyCaching 空操作', () => {
    const strat = strategyFor('deepseek:deepseek-chat', 'c')
    const plan = {
      system: [],
      stableBoundary: 0,
      leadingUser: [],
      volatilePrefixUser: [],
      trailingUser: [],
      history: []
    }
    expect(strat.applyCaching(plan)).toEqual(plan)
  })
})

describe('budget — 锚点 + 增量估算', () => {
  it('有锚点时只估增量', () => {
    const budget = createBudget()
    const base: ModelMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' }
    ]
    budget.anchor('c', base.length, 10_000)
    const grown = [...base, { role: 'user' as const, content: 'x'.repeat(400) }]
    const usage = budget.measureUsage('c', grown)
    expect(usage.inputTokens).toBeGreaterThan(10_000)
    expect(usage.inputTokens).toBeLessThan(10_000 + roughEstimate(grown))
  })

  it('无锚点时全量估算', () => {
    const budget = createBudget()
    const msgs: ModelMessage[] = [{ role: 'user', content: 'hello world' }]
    const usage = budget.measureUsage('c', msgs)
    expect(usage.source).toBe('estimated')
    expect(usage.inputTokens).toBe(roughEstimate(msgs))
  })
})

describe('prompt cache diagnostics — step 指纹', () => {
  const def = {
    id: 'general',
    name: 'General',
    description: '',
    kind: 'main',
    modelRef: 'openai:gpt-5.5',
    systemPrompt: 'stable role',
    allowedTools: null
  } as const

  it('记录结构 hash,不把原始 message 文本落进 segments', () => {
    const record = buildPromptCacheDiagnostic({
      id: 'd1',
      conversationId: 'chat-1',
      runId: 'run-1',
      stepNumber: 1,
      createdAt: 1,
      def,
      tools: {},
      prepared: {
        providerOptions: { openai: { promptCacheKey: 'chat-1', promptCacheRetention: '24h' } },
        messages: [{ role: 'user', content: 'secret user text' }]
      }
    })
    expect(record.promptCacheKey).toBe('chat-1')
    expect(record.promptCacheRetention).toBe('24h')
    expect(record.segmentsJson).not.toContain('secret user text')
    expect(JSON.parse(record.segmentsJson)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'message', role: 'user', hash: expect.any(String) })
      ])
    )
  })

  it('和上一条诊断对比,定位第一处前缀变化段', () => {
    const first = buildPromptCacheDiagnostic({
      id: 'd1',
      conversationId: 'chat-1',
      runId: 'run-1',
      stepNumber: 1,
      createdAt: 1,
      def,
      tools: {},
      prepared: {
        messages: [
          { role: 'user', content: 'stable' },
          { role: 'assistant', content: 'old' }
        ]
      }
    })
    const second = buildPromptCacheDiagnostic({
      id: 'd2',
      conversationId: 'chat-1',
      runId: 'run-1',
      stepNumber: 2,
      createdAt: 2,
      def,
      tools: {},
      prepared: {
        messages: [
          { role: 'user', content: 'stable' },
          { role: 'assistant', content: 'new' }
        ]
      },
      previous: { id: first.id, segmentsJson: first.segmentsJson }
    })
    const diff = JSON.parse(second.diffJson ?? '{}') as { firstDifference: { index: number } }
    expect(diff.firstDifference.index).toBe(3)
  })
})

describe('compaction policy + capabilities', () => {
  it('从 capabilities 派生压缩触发值和保留量', () => {
    const policy = computeCompactionPolicy(CAP)
    expect(policy).toEqual({
      compactionTriggerTokens: 172_627,
      retainedRecentTokens: 20_000
    })
  })

  it('capabilitiesFor 填默认值', () => {
    const cap = createCapabilities(() => undefined)('x:y')
    expect(cap.contextWindow).toBeGreaterThan(0)
    expect(cap.maxOutputTokens).toBeGreaterThan(0)
    expect(cap.supportsImages).toBe(false)
  })
})
