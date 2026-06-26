import { describe, it, expect } from 'vitest'
import { convertToModelMessages, type UIMessage } from 'ai'

describe('P2 — convertToModelMessages 是 async(投影层必须 await)', () => {
  it('返回 Promise,await 后才是数组', async () => {
    const ui = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }] as UIMessage[]
    const ret = convertToModelMessages(ui)
    expect(typeof (ret as PromiseLike<unknown>).then).toBe('function')
    const msgs = await ret
    expect(Array.isArray(msgs)).toBe(true)
    expect(msgs).toHaveLength(1)
  })
})

describe('P3 — section 稳定/易变分段排序(compileSections 核心纯函数)', () => {
  type Stability = 'stable' | 'volatile'
  interface Section {
    id: string
    stability: Stability
    order: number
    text: string
  }

  function layout(sections: Section[]): { ordered: Section[]; boundary: number } {
    const stable = sections
      .filter((s) => s.stability === 'stable')
      .sort((a, b) => a.order - b.order)
    const volatile = sections
      .filter((s) => s.stability === 'volatile')
      .sort((a, b) => a.order - b.order)
    return { ordered: [...stable, ...volatile], boundary: stable.length }
  }

  it('易变段恒在稳定段之后,且 boundary 指向第一个易变段', () => {
    const sections: Section[] = [
      { id: 'datetime', stability: 'volatile', order: 0, text: '2026-06-01' },
      { id: 'role', stability: 'stable', order: 0, text: 'ROLE' },
      { id: 'git', stability: 'volatile', order: 1, text: 'GIT' },
      { id: 'tools-doc', stability: 'stable', order: 1, text: 'TOOLS' }
    ]
    const { ordered, boundary } = layout(sections)
    expect(ordered.map((s) => s.id)).toEqual(['role', 'tools-doc', 'datetime', 'git'])
    expect(boundary).toBe(2)

    expect(ordered.slice(0, boundary).every((s) => s.stability === 'stable')).toBe(true)
    expect(ordered.slice(boundary).every((s) => s.stability === 'volatile')).toBe(true)
  })
})
