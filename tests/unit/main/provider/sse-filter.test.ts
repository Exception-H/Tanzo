import { describe, expect, it } from 'vitest'
import { filterResponsesApiSseFetch } from '@main/provider/sse-filter'

async function text(response: Response): Promise<string> {
  return response.text()
}

async function json(response: Response): Promise<unknown> {
  return JSON.parse(await response.text())
}

describe('provider/sse-filter', () => {
  it('keeps only Responses API data frames from SSE streams', async () => {
    const dummy = JSON.stringify({
      id: 'chatcmpl-ws-ingress',
      object: 'chat.completion.chunk',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: '\u200b' }
        }
      ]
    })
    const real = JSON.stringify({
      type: 'response.output_text.delta',
      item_id: 'item-1',
      output_index: 0,
      content_index: 0,
      delta: 'hello'
    })
    const body = `data: ${dummy}\n\nevent: response.output_text.delta\ndata: ${real}\n\ndata: [DONE]\n`
    const fetcher = filterResponsesApiSseFetch(
      async () =>
        new Response(body, {
          headers: { 'content-type': 'text/event-stream' }
        })
    )

    await expect(text(await fetcher('https://example.test/v1/responses'))).resolves.toBe(
      `event: response.output_text.delta\ndata: ${real}\n\ndata: [DONE]\n`
    )
  })

  it('keeps Responses API error events', async () => {
    const error = JSON.stringify({
      type: 'error',
      sequence_number: 1,
      error: { message: 'bad upstream' }
    })
    const chatCompletion = JSON.stringify({
      id: 'chatcmpl-real-looking',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: 'wrong stream' } }]
    })
    const body = `data: ${chatCompletion}\n\ndata: ${error}\n`
    const fetcher = filterResponsesApiSseFetch(
      async () =>
        new Response(body, {
          headers: { 'content-type': 'text/event-stream' }
        })
    )

    await expect(text(await fetcher('https://example.test/v1/responses'))).resolves.toBe(
      `data: ${error}\n`
    )
  })

  it('drops malformed data frames from SSE streams', async () => {
    const real = JSON.stringify({
      type: 'response.completed',
      response: { id: 'resp-1' }
    })
    const body = `data: {"not json"\n\ndata: ${real}\n`
    const fetcher = filterResponsesApiSseFetch(
      async () =>
        new Response(body, {
          headers: { 'content-type': 'text/event-stream' }
        })
    )

    await expect(text(await fetcher('https://example.test/v1/responses'))).resolves.toBe(
      `data: ${real}\n`
    )
  })

  it('leaves Chat Completions SSE streams untouched', async () => {
    const chatCompletion = JSON.stringify({
      id: 'chatcmpl-real',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: 'hello' } }]
    })
    const body = `data: ${chatCompletion}\n\ndata: [DONE]\n`
    const fetcher = filterResponsesApiSseFetch(
      async () =>
        new Response(body, {
          headers: { 'content-type': 'text/event-stream' }
        })
    )

    await expect(text(await fetcher('https://example.test/v1/chat/completions'))).resolves.toBe(
      body
    )
  })

  it('normalizes Responses API JSON output text without ids or annotations', async () => {
    const body = JSON.stringify({
      id: 'resp-1',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '<summary>ok</summary>' }]
        }
      ]
    })
    const fetcher = filterResponsesApiSseFetch(
      async () => new Response(body, { headers: { 'content-type': 'application/json' } })
    )

    await expect(json(await fetcher('https://example.test/v1/responses'))).resolves.toEqual({
      id: 'resp-1',
      output: [
        {
          type: 'message',
          role: 'assistant',
          id: 'response-output-0',
          content: [{ type: 'output_text', text: '<summary>ok</summary>', annotations: [] }]
        }
      ]
    })
  })

  it('normalizes Responses API reasoning output without id or summary', async () => {
    const body = JSON.stringify({
      id: 'resp-1',
      output: [{ type: 'reasoning' }]
    })
    const fetcher = filterResponsesApiSseFetch(
      async () => new Response(body, { headers: { 'content-type': 'application/json' } })
    )

    await expect(json(await fetcher('https://example.test/v1/responses'))).resolves.toEqual({
      id: 'resp-1',
      output: [{ type: 'reasoning', id: 'response-output-0', summary: [] }]
    })
  })

  it('normalizes completed Responses API JSON with reasoning and message items', async () => {
    const body = JSON.stringify({
      id: 'resp-1',
      status: 'completed',
      output: [
        {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'thinking' }]
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '<summary>ok</summary>' }]
        }
      ]
    })
    const fetcher = filterResponsesApiSseFetch(
      async () => new Response(body, { headers: { 'content-type': 'application/json' } })
    )

    await expect(json(await fetcher('https://example.test/v1/responses'))).resolves.toEqual({
      id: 'resp-1',
      status: 'completed',
      output: [
        {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'thinking' }],
          id: 'response-output-0'
        },
        {
          type: 'message',
          role: 'assistant',
          id: 'response-output-1',
          content: [{ type: 'output_text', text: '<summary>ok</summary>', annotations: [] }]
        }
      ]
    })
  })

  it('leaves non-SSE responses untouched', async () => {
    const fetcher = filterResponsesApiSseFetch(
      async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })
    )

    await expect(text(await fetcher('https://example.test'))).resolves.toBe('{"ok":true}')
  })
})
