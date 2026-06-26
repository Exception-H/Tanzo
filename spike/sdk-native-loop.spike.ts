import { describe, it, expect } from 'vitest'
import {
  streamText,
  createUIMessageStream,
  toUIMessageStream,
  readUIMessageStream,
  convertToModelMessages,
  tool,
  type ModelMessage,
  type UIMessage,
  type ToolSet
} from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { z } from 'zod'

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
  totalTokens: 15
}

function toolCallStep(toolCallId: string, toolName: string, input: string) {
  return new ReadableStream({
    start(c) {
      c.enqueue({ type: 'stream-start', warnings: [] })
      c.enqueue({ type: 'tool-input-start', id: toolCallId, toolName })
      c.enqueue({ type: 'tool-input-delta', id: toolCallId, delta: input })
      c.enqueue({ type: 'tool-input-end', id: toolCallId })
      c.enqueue({ type: 'tool-call', toolCallId, toolName, input })
      c.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: USAGE })
      c.close()
    }
  })
}

function textStep(text: string) {
  return new ReadableStream({
    start(c) {
      c.enqueue({ type: 'stream-start', warnings: [] })
      c.enqueue({ type: 'text-start', id: 't1' })
      c.enqueue({ type: 'text-delta', id: 't1', delta: text })
      c.enqueue({ type: 'text-end', id: 't1' })
      c.enqueue({ type: 'finish', finishReason: 'stop', usage: USAGE })
      c.close()
    }
  })
}

describe('sdk-native loop — the SDK owns the step loop', () => {
  it('N1-N3: one call drives N steps, prepareStep rebuilds from clean fields, no accumulation', async () => {
    const sentPrompts: ModelMessage[][] = []
    let call = 0
    const model = new MockLanguageModelV4({
      doStream: async (options) => {
        sentPrompts.push(options.prompt as ModelMessage[])
        call += 1
        return {
          stream: call === 1 ? toolCallStep('call-1', 'echo', '{"msg":"hi"}') : textStep('done')
        }
      }
    })

    let executed = 0
    const tools: ToolSet = {
      echo: tool({
        description: 'echo a message',
        inputSchema: z.object({ msg: z.string() }),
        async execute({ msg }) {
          executed += 1
          return { echoed: msg }
        }
      })
    }

    const userTurn: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'please echo hi' }] }
    ]
    const initialMessages: ModelMessage[] = await convertToModelMessages(userTurn, { tools })

    const INJECTED = 'INJECTED-CONTEXT-FOR-THIS-STEP'
    const builtTranscripts: ModelMessage[][] = []

    let steps = 0
    const uiStream = createUIMessageStream<UIMessage>({
      originalMessages: userTurn,
      execute: async ({ writer }) => {
        const result = streamText({
          model,
          tools,
          messages: initialMessages,
          stopWhen: () => false,
          prepareStep: ({ initialMessages: clean, responseMessages }) => {
            steps += 1
            const transcript = [
              ...(clean as ModelMessage[]),
              ...(responseMessages as ModelMessage[])
            ]
            builtTranscripts.push(transcript)
            return { instructions: INJECTED, messages: transcript }
          }
        })
        writer.merge(toUIMessageStream<ToolSet, UIMessage>({ stream: result.stream }))
        await result.steps
      }
    })

    const chunkTypes: string[] = []
    for await (const chunk of uiStream) chunkTypes.push((chunk as { type: string }).type)

    expect(call).toBe(2)
    expect(steps).toBe(2)
    expect(executed).toBe(1)

    expect(sentPrompts).toHaveLength(2)
    for (const prompt of sentPrompts) {
      const injectedCount = prompt.filter(
        (m) => m.role === 'system' && m.content === INJECTED
      ).length
      expect(injectedCount).toBe(1)
    }

    const step2 = builtTranscripts[1]
    expect(step2.some((m) => m.role === 'system')).toBe(false)
    expect(step2.length).toBeGreaterThan(builtTranscripts[0].length)
    expect(JSON.stringify(step2)).not.toContain(INJECTED)
  })

  it('N4: one streamText call yields a single coherent assistant message', async () => {
    let call = 0
    const model = new MockLanguageModelV4({
      doStream: async () => {
        call += 1
        return {
          stream: call === 1 ? toolCallStep('call-1', 'echo', '{"msg":"hi"}') : textStep('done')
        }
      }
    })
    const tools: ToolSet = {
      echo: tool({
        description: 'echo a message',
        inputSchema: z.object({ msg: z.string() }),
        async execute({ msg }) {
          return { echoed: msg }
        }
      })
    }
    const userTurn: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'please echo hi' }] }
    ]
    const initialMessages: ModelMessage[] = await convertToModelMessages(userTurn, { tools })

    const uiStream = createUIMessageStream<UIMessage>({
      originalMessages: userTurn,
      generateId: () => 'assistant-fixed',
      execute: async ({ writer }) => {
        const result = streamText({
          model,
          tools,
          instructions: 'sys',
          messages: initialMessages,
          stopWhen: () => false
        })
        writer.merge(toUIMessageStream<ToolSet, UIMessage>({ stream: result.stream }))
        await result.steps
      }
    })

    let last: UIMessage | undefined
    for await (const message of readUIMessageStream({ stream: uiStream })) last = message

    expect(last?.role).toBe('assistant')
    const partTypes = (last?.parts ?? []).map((p) => p.type)
    expect(partTypes.some((t) => t.startsWith('tool-'))).toBe(true)
    expect(partTypes).toContain('text')
  })
})
