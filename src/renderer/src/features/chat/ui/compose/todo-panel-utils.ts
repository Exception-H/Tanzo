export type TodoPanelStatus = 'pending' | 'in_progress' | 'completed'

export interface TodoPanelTask {
  content: string
  status: TodoPanelStatus
}

const TODO_PANEL_VISIBLE_ROWS = 5
const TODO_PANEL_ROW_HEIGHT_REM = 1.75
const TODO_PANEL_VERTICAL_PADDING_REM = 0.5
export const TODO_PANEL_CONTENT_MAX_HEIGHT_REM =
  TODO_PANEL_VISIBLE_ROWS * TODO_PANEL_ROW_HEIGHT_REM + TODO_PANEL_VERTICAL_PADDING_REM

export function selectLatestTodos(
  messages: ReadonlyArray<{ parts?: ReadonlyArray<unknown> }>
): TodoPanelTask[] {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m]?.parts ?? []
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p] as { type?: string; input?: { items?: TodoPanelTask[] } }
      if (part?.type === 'tool-todo' && Array.isArray(part.input?.items)) {
        return part.input.items
      }
    }
  }
  return []
}
