import type { SqlDatabase } from '../../database/types'

export interface QueuedMessageRepo {
  listAll(): Array<{ chatId: string; items: string[] }>
  saveFor(chatId: string, items: string[]): void
}

export function createQueuedMessageRepo(db: SqlDatabase): QueuedMessageRepo {
  const selectAll = db.prepare(
    'SELECT conversation_id, position, text FROM queued_messages ORDER BY conversation_id, position'
  )
  const deleteFor = db.prepare('DELETE FROM queued_messages WHERE conversation_id = ?')
  const insertRow = db.prepare(`
    INSERT INTO queued_messages (conversation_id, position, text, created_at)
    VALUES (@conversation_id, @position, @text, @created_at)
  `)

  return {
    listAll() {
      const rows = selectAll.all() as Array<{
        conversation_id: string
        position: number
        text: string
      }>
      const byChat = new Map<string, string[]>()
      for (const row of rows) {
        const items = byChat.get(row.conversation_id)
        if (items) items.push(row.text)
        else byChat.set(row.conversation_id, [row.text])
      }
      return [...byChat.entries()].map(([chatId, items]) => ({ chatId, items }))
    },
    saveFor(chatId, items) {
      db.transaction(() => {
        deleteFor.run([chatId])
        items.forEach((text, position) =>
          insertRow.run({
            conversation_id: chatId,
            position,
            text,
            created_at: Date.now()
          })
        )
      })
    }
  }
}
