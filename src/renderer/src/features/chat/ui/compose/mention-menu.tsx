import { useEffect, useRef } from 'react'
import { File, Folder } from 'lucide-react'
import type { FileMentionEntry } from '@shared/file-mention'
import { cn } from '@/lib/utils'
import { composeSurfaceClass } from './surface-style'

interface MentionMenuProps {
  entries: FileMentionEntry[]
  highlightedIndex: number
  onHighlight: (index: number) => void
  onSelect: (entry: FileMentionEntry) => void
  className?: string
}

export function MentionMenu({
  entries,
  highlightedIndex,
  onHighlight,
  onSelect,
  className
}: MentionMenuProps): React.JSX.Element | null {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const active = entries[highlightedIndex]
    if (!active || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-mention="${active.path}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [entries, highlightedIndex])

  if (entries.length === 0) return null

  return (
    <div
      ref={listRef}
      className={cn(
        'pointer-events-auto max-h-[208px] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-[calc(var(--radius)+8px)] p-1.5',
        composeSurfaceClass,
        'transition-[background-color,border-color,box-shadow] duration-200 ease-out',
        className
      )}
    >
      {entries.map((entry, index) => {
        const selected = index === highlightedIndex
        const Icon = entry.type === 'directory' ? Folder : File
        const dir = entry.path.slice(0, entry.path.length - entry.name.length).replace(/\/$/, '')
        return (
          <button
            key={entry.path}
            type="button"
            data-mention={entry.path}
            onMouseEnter={() => onHighlight(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(entry)
            }}
            className={cn(
              'flex h-6 w-full items-center gap-2 rounded-[calc(var(--radius)-2px)] px-2 text-[0.6875rem] font-medium',
              selected ? 'bg-foreground/[0.08] text-foreground' : 'text-foreground/85'
            )}
          >
            <Icon
              className={cn(
                'size-3 shrink-0',
                selected ? 'text-foreground/90' : 'text-muted-foreground/60'
              )}
              strokeWidth={1.8}
            />
            <span className="truncate">{entry.name}</span>
            {dir ? (
              <span className="ml-auto shrink-0 truncate text-[0.5625rem] font-medium text-muted-foreground/50">
                {dir}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
