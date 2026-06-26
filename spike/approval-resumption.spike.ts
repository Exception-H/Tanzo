import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  ToolLoopAgent,
  tool,
  convertToModelMessages,
  isStepCount,
  type UIMessage,
  type ToolApprovalStatus
} from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
  totalTokens: 2
}

function streamOf(parts: unknown[]) {
  return {
    stream: new ReadableStream({
      start(c) {
        c.enqueue({ type: 'stream-start', warnings: [] })
        for (const p of parts) c.enqueue(p)
        c.close()
      }
    })
  }
}

function makeAgent(doStream: ReturnType<typeof streamOf>, onApproval: () => void) {
  let executed = 0
  const writeFile = tool({
    description: 'write a file',
    inputSchema: z.object({ path: z.string() }),
    async execute({ path }) {
      executed++
      return { ok: true, path }
    }
  })
  const agent = new ToolLoopAgent({
    model: new MockLanguageModelV4({ doStream }),
    tools: { writeFile },
    stopWhen: isStepCount(10),
    toolApproval: (): ToolApprovalStatus => {
      onApproval()
      return 'user-approval'
    }
  })
  return { agent, writeFile, executed: () => executed }
}

test('R1 — tool call 需审批时，流自然停止、工具不执行', async () => {
  let approvalCalls = 0
  const { agent, executed } = makeAgent(
    streamOf([
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'writeFile', input: '{"path":"a.txt"}' },
      { type: 'finish', finishReason: 'tool-calls', usage: USAGE }
    ]),
    () => approvalCalls++
  )

  const history: UIMessage[] = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'write a.txt' }] }
  ]
  const r = await agent.stream({ messages: await convertToModelMessages(history) })

  let sawApprovalRequest = false
  for await (const part of r.fullStream) {
    if ((part as { type: string }).type === 'tool-approval-request') sawApprovalRequest = true
  }

  assert.equal(approvalCalls, 1, 'toolApproval 应被询问一次')
  assert.equal(sawApprovalRequest, true, '应吐出 tool-approval-request chunk')
  assert.equal(executed(), 0, '审批未决，工具不应执行')
})

test('R2 — 历史里已批准的 tool call，在全新的 agent.stream 中被执行而非重问', async () => {
  let approvalCalls = 0

  const { agent, writeFile, executed } = makeAgent(
    streamOf([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'done' },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: 'stop', usage: USAGE }
    ]),
    () => approvalCalls++
  )

  const history: UIMessage[] = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'write a.txt' }] },
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-writeFile',
          toolCallId: 'call-1',
          state: 'approval-responded',
          input: { path: 'a.txt' },
          approval: { id: 'appr-1', approved: true }
        } as never
      ]
    }
  ]

  const messages = await convertToModelMessages(history, { tools: { writeFile } })
  const r = await agent.stream({ messages })

  let firstChunkType = ''
  for await (const part of r.fullStream) {
    const t = (part as { type: string }).type
    if (!firstChunkType && t !== 'start') firstChunkType = t
  }

  assert.equal(executed(), 1, '已批准的 tool call 应被执行一次（承重假设成立）')
  assert.equal(approvalCalls, 0, '不应重新询问审批')
  assert.equal(firstChunkType, 'tool-result', '执行先于任何新模型输出（从历史直接执行）')
})
