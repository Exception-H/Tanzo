import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface CollapsibleGridProps<T> {
  title: string
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  getItemKey: (item: T) => string | number
  defaultOpen?: boolean
}

export function CollapsibleGrid<T>({
  title,
  items,
  renderItem,
  getItemKey,
  defaultOpen = true
}: CollapsibleGridProps<T>) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (items.length === 0) {
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/section">
      <CollapsibleTrigger className="group/trigger relative flex w-full items-center gap-2.5 rounded-md px-0.5 py-2 transition-colors duration-200 shadow-none hover:shadow-none focus-visible:shadow-none">
        <div
          className={cn(
            'ml-1 h-3.5 w-0.5 rounded-full transition-colors duration-200',
            isOpen ? 'bg-foreground/70' : 'bg-muted-foreground/30',
            'group-hover/trigger:bg-foreground/60'
          )}
        />
        <ChevronRight
          className={cn(
            'size-3.5 text-muted-foreground/70 transition-all duration-300 ease-out',
            'group-hover/trigger:text-foreground/80',
            isOpen && 'rotate-90 text-foreground'
          )}
        />
        <h2
          className={cn(
            'text-[0.8125rem] font-semibold tracking-tight transition-colors duration-200',
            isOpen ? 'text-foreground' : 'text-foreground/80'
          )}
        >
          {title}
        </h2>
        <span className="text-[0.6875rem] font-medium tabular-nums text-muted-foreground/70">
          {items.length}
        </span>
        <div className="relative h-px flex-1 overflow-hidden">
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-border/50 via-border/20 to-transparent transition-colors duration-200',
              'group-hover/trigger:from-border/60 group-hover/trigger:via-border/30',
              isOpen && 'from-border/70 via-border/35'
            )}
          />
          <div
            className={cn(
              'absolute left-0 top-0 h-full w-1/4 bg-gradient-to-r from-transparent via-foreground/12 to-transparent',
              'translate-x-[-120%] transition-transform duration-700 ease-out',
              'group-hover/trigger:translate-x-[380%]'
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent
        className={cn(
          'transition-all duration-300 ease-out',
          'data-[state=closed]:animate-out data-[state=open]:animate-in',
          'data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1'
        )}
      >
        <div className="pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item, index) => (
              <div key={getItemKey(item)}>{renderItem(item, index)}</div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
