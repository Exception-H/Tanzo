import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import type { FileMentionEntry } from '@shared/file-mention'
import { fileMentionClient } from '@/platform/electron/file-mention-client'

const SEARCH_DEBOUNCE_MS = 80

export interface MentionContext {
  query: string
  start: number
  end: number
}

function isBoundary(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char)
}

export function getMentionContext(value: string, cursor: number): MentionContext | null {
  const safeCursor = Math.max(0, Math.min(cursor, value.length))
  let start = safeCursor
  while (start > 0 && !/\s/.test(value[start - 1])) start -= 1
  if (value[start] !== '@') return null
  if (!isBoundary(value[start - 1])) return null
  let end = safeCursor
  while (end < value.length && !/\s/.test(value[end])) end += 1
  if (safeCursor < start || safeCursor > end) return null
  return { query: value.slice(start + 1, end), start, end }
}

function formatInsertion(entry: FileMentionEntry): string {
  const path = entry.type === 'directory' ? `${entry.path}/` : entry.path
  return /\s/.test(path) ? `"${path}"` : path
}

export interface UseMentionMenuArgs {
  value: string
  setValue: (next: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  workspaceRoot: string | null
  isStreaming: boolean
}

export interface UseMentionMenuResult {
  mentionMenuOpen: boolean
  mentionEntries: FileMentionEntry[]
  mentionHighlight: number
  setMentionHighlight: React.Dispatch<React.SetStateAction<number>>
  selectMention: (entry: FileMentionEntry) => void
  syncMention: () => void
  handleMentionKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    composing: boolean
  ) => boolean
}

export function useMentionMenu({
  value,
  setValue,
  textareaRef,
  workspaceRoot,
  isStreaming
}: UseMentionMenuArgs): UseMentionMenuResult {
  const [cursor, setCursor] = useState(0)
  const [entries, setEntries] = useState<FileMentionEntry[]>([])
  const [highlight, setHighlight] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)

  const canOpen = Boolean(workspaceRoot) && !isStreaming

  const context = useMemo(() => {
    if (!canOpen) return null
    const next = getMentionContext(value, cursor)
    if (!next) return null
    if (dismissed !== null && dismissed === next.query) return null
    return next
  }, [canOpen, value, cursor, dismissed])

  const contextKey = context ? `${context.start}:${context.query}` : null

  const syncMention = useCallback(() => {
    const el = textareaRef.current
    setCursor(el ? el.selectionStart : value.length)
    setDismissed(null)
  }, [textareaRef, value])

  useEffect(() => {
    if (!context || !workspaceRoot) return
    let active = true
    const handle = setTimeout(() => {
      void fileMentionClient
        .search(workspaceRoot, context.query)
        .then((result) => {
          if (!active) return
          setEntries(result)
          setHighlight(0)
        })
        .catch(() => {
          if (active) setEntries([])
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [context, contextKey, workspaceRoot])

  const mentionEntries = useMemo(() => (context ? entries : []), [context, entries])
  const mentionMenuOpen = context !== null && mentionEntries.length > 0

  const selectMention = useCallback(
    (entry: FileMentionEntry) => {
      const target = context ?? getMentionContext(value, textareaRef.current?.selectionStart ?? 0)
      if (!target) return

      if (entry.type === 'directory') {
        const drill = `@${entry.path}/`
        const next = `${value.slice(0, target.start)}${drill}${value.slice(target.end)}`
        const caret = target.start + drill.length
        setValue(next)
        requestAnimationFrame(() => {
          const el = textareaRef.current
          if (!el) return
          el.focus()
          el.setSelectionRange(caret, caret)
          setCursor(caret)
          setDismissed(null)
        })
        return
      }

      const insertion = formatInsertion(entry)
      const next = `${value.slice(0, target.start)}${insertion} ${value.slice(target.end)}`
      const caret = target.start + insertion.length + 1
      setValue(next)
      setDismissed(insertion)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(caret, caret)
        setCursor(caret)
      })
    },
    [context, setValue, textareaRef, value]
  )

  const handleMentionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>, composing: boolean): boolean => {
      if (!mentionMenuOpen) return false
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlight((index) => (index + 1) % mentionEntries.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlight((index) => (index - 1 + mentionEntries.length) % mentionEntries.length)
        return true
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !composing) {
        event.preventDefault()
        const entry = mentionEntries[highlight] ?? mentionEntries[0]
        if (entry) selectMention(entry)
        return true
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissed(context?.query ?? '')
        return true
      }
      return false
    },
    [mentionMenuOpen, mentionEntries, highlight, selectMention, context]
  )

  return useMemo(
    () => ({
      mentionMenuOpen,
      mentionEntries,
      mentionHighlight: highlight,
      setMentionHighlight: setHighlight,
      selectMention,
      syncMention,
      handleMentionKeyDown
    }),
    [mentionMenuOpen, mentionEntries, highlight, selectMention, syncMention, handleMentionKeyDown]
  )
}
