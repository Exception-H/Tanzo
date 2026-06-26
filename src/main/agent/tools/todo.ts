import { tool, zodSchema, type Tool } from 'ai'
import type { TanzoTools, TanzoUIMessage } from '@shared/agent-message'
import type { ToolDeps } from './types'
import { toolResultToModelOutput } from './model-output'
import { todoInputSchema } from './tool-schemas'

type TodoItem = TanzoTools['todo']['input']['items'][number]
type TodoStatus = TodoItem['status']

const DESC =
  'Maintain a structured checklist for the current task. Pass the full list every time; it ' +
  'replaces the previous list. Use it for multi-step work (3+ steps), not for single trivial ' +
  'tasks. Keep exactly one item in_progress while working; mark items completed only when truly ' +
  'done. Do not silently drop unfinished items — finish, keep, or remove them deliberately.'

function normalizeActive(items: TodoItem[]): { items: TodoItem[]; note?: string } {
  let seenActive = false
  let demoted = 0
  const next = items.map((item) => {
    if (item.status !== 'in_progress') return item
    if (!seenActive) {
      seenActive = true
      return item
    }
    demoted += 1
    return { ...item, status: 'pending' as TodoStatus }
  })
  if (demoted === 0) return { items: next }
  return {
    items: next,
    note: `Only one item may be in_progress; demoted ${demoted} extra in_progress item(s) to pending.`
  }
}

async function previousItems(deps: ToolDeps, chatId: string): Promise<TodoItem[]> {
  let messages: TanzoUIMessage[]
  try {
    messages = await deps.store.load(chatId)
  } catch {
    return []
  }
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m]?.parts ?? []
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p] as {
        type?: string
        input?: { items?: TodoItem[] }
        output?: { items?: TodoItem[] }
      }
      if (part.type === 'tool-todo') {
        if (Array.isArray(part.output?.items)) return part.output.items
        if (Array.isArray(part.input?.items)) return part.input.items
      }
    }
  }
  return []
}

function detectDropped(prev: TodoItem[], next: TodoItem[]): string[] {
  const kept = new Set(next.map((item) => item.content))
  return prev
    .filter((item) => item.status !== 'completed' && !kept.has(item.content))
    .map((item) => item.content)
}

function countByStatus(items: TodoItem[]): {
  pending: number
  in_progress: number
  completed: number
} {
  const counts = { pending: 0, in_progress: 0, completed: 0 }
  for (const item of items) counts[item.status] += 1
  return counts
}

export function todoTool(
  deps: ToolDeps,
  chatId: string
): Tool<TanzoTools['todo']['input'], TanzoTools['todo']['output']> {
  return tool<TanzoTools['todo']['input'], TanzoTools['todo']['output'], Record<string, unknown>>({
    description: DESC,
    inputSchema: zodSchema(todoInputSchema),
    metadata: { tanzo: { kind: 'exec', component: 'TodoCard' } },
    toModelOutput: toolResultToModelOutput,
    async execute({ items }) {
      const prev = await previousItems(deps, chatId)
      const { items: normalized, note } = normalizeActive(items)
      const dropped = detectDropped(prev, normalized)
      return {
        ok: true,
        items: normalized,
        counts: countByStatus(normalized),
        ...(note ? { normalized: note } : {}),
        ...(dropped.length > 0 ? { dropped } : {})
      }
    }
  }) as Tool<TanzoTools['todo']['input'], TanzoTools['todo']['output']>
}
