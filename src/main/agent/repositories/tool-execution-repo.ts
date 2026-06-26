import type { SqlDatabase } from '../../database/types'

export interface ToolExecutionRecord {
  id: string
  runId: string
  conversationId: string
  toolName: string
  toolCallId?: string
  success: boolean
  durationMs?: number
  errorKind?: string
  errorMessage?: string
  createdAt: number
}

export interface ToolExecutionRepo {
  record(record: ToolExecutionRecord): void
  pruneBefore(cutoff: number): void
}

export function createToolExecutionRepo(db: SqlDatabase): ToolExecutionRepo {
  const pruneToolExecutions = db.prepare('DELETE FROM tool_executions WHERE created_at < ?')
  const insertToolExecution = db.prepare(`
    INSERT INTO tool_executions (
      id,
      run_id,
      conversation_id,
      tool_name,
      tool_call_id,
      success,
      duration_ms,
      error_kind,
      error_message,
      created_at
    ) VALUES (
      @id,
      @run_id,
      @conversation_id,
      @tool_name,
      @tool_call_id,
      @success,
      @duration_ms,
      @error_kind,
      @error_message,
      @created_at
    )
    ON CONFLICT(id) DO NOTHING
  `)

  return {
    record(record) {
      insertToolExecution.run({
        id: record.id,
        run_id: record.runId,
        conversation_id: record.conversationId,
        tool_name: record.toolName,
        tool_call_id: record.toolCallId ?? null,
        success: record.success ? 1 : 0,
        duration_ms: record.durationMs ?? null,
        error_kind: record.errorKind ?? null,
        error_message: record.errorMessage ?? null,
        created_at: record.createdAt
      })
    },
    pruneBefore(cutoff) {
      pruneToolExecutions.run([cutoff])
    }
  }
}
