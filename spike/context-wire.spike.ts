import { describe, it, expect } from 'vitest'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, convertToModelMessages, type ModelMessage, type UIMessage } from 'ai'

interface AnthropicWireBody {
  system?: Array<{ text?: string; cache_control?: unknown }>
  messages?: Array<{ content: Array<{ cache_control?: unknown }> }>
}

function captureFetch() {
  const bodies: AnthropicWireBody[] = []
  const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as AnthropicWireBody)
    const sse = [
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: 'msg_spike',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-5',
          content: [],
          stop_reason: null,
          usage: { input_tokens: 10, output_tokens: 0 }
        }
      })}\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } })}\n\n`,
      `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
      `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } })}\n\n`,
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`
    ].join('')
    return new Response(sse, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })
  }) as unknown as typeof globalThis.fetch
  return { bodies, fetch }
}

async function drain(result: Awaited<ReturnType<typeof streamText>>) {
  for await (const _ of result.fullStream) void _
}

describe('H1 — 多段 system[] 各带 cacheControl 透传到 wire', () => {
  it('稳定段打 1h 断点,易变段不打 → wire 出现带 cache_control 的 system block', async () => {
    const { bodies, fetch } = captureFetch()
    const model = createAnthropic({ apiKey: 'spike', fetch })('claude-opus-4-5')

    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'hi' }],
      prepareStep: () => ({
        system: [
          {
            role: 'system',
            content: 'STABLE: role + tools doc',
            providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } }
          },
          {
            role: 'system',
            content: 'VOLATILE: current datetime 2026-06-01'
          }
        ]
      })
    })
    await drain(result)

    expect(bodies).toHaveLength(1)
    const sys = bodies[0].system

    expect(Array.isArray(sys)).toBe(true)
    expect(sys).toHaveLength(2)
    expect(sys[0].text).toContain('STABLE')

    expect(sys[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(sys[1].cache_control).toBeUndefined()
  })
})

describe('H3 — 历史末尾消息打 5m 断点透传(增量缓存)', () => {
  it('convertToModelMessages 后给 last message 挂 cacheControl → wire 末块带 cache_control', async () => {
    const { bodies, fetch } = captureFetch()
    const model = createAnthropic({ apiKey: 'spike', fetch })('claude-opus-4-5')

    const ui: UIMessage[] = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'first' }] },
      { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'reply' }] },
      { id: 'm3', role: 'user', parts: [{ type: 'text', text: 'latest turn' }] }
    ]
    const msgs: ModelMessage[] = await convertToModelMessages(ui)
    expect(msgs.length).toBe(3)
    const last = msgs[msgs.length - 1]
    last.providerOptions = { anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } } }

    const result = streamText({ model, messages: msgs })
    await drain(result)

    const wireMsgs = bodies[0].messages
    const lastWire = wireMsgs[wireMsgs.length - 1]

    const lastBlock = lastWire.content[lastWire.content.length - 1]
    expect(lastBlock.cache_control).toEqual({ type: 'ephemeral', ttl: '5m' })
  })
})
