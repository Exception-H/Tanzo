import { isValidElement, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ServerForm } from './server-form'
import type { McpServerConfig } from '@/common/contracts'

export interface ServerEditorDialogProps {
  mode: 'create' | 'edit'
  server?: McpServerConfig
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ServerEditorDialog({
  mode,
  server,
  trigger,
  open,
  onOpenChange
}: ServerEditorDialogProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const resolvedOpen = isControlled ? open : internalOpen

  const defaultCreateTrigger = (
    <Button size="sm" className="h-7 rounded-[var(--radius-lg)] px-3 text-[0.6875rem] gap-2">
      <Plus className="size-3.5" />
      {t('mcp.server.create.button')}
    </Button>
  )

  const triggerNode = mode === 'create' ? (trigger ?? defaultCreateTrigger) : trigger
  const triggerElement = triggerNode && isValidElement(triggerNode) ? triggerNode : null
  const title = mode === 'create' ? t('mcp.server.create.title') : t('mcp.server.edit.title')

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  const handleClose = () => {
    handleOpenChange(false)
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerElement && <DialogTrigger render={triggerElement} />}
      <DialogContent
        showCloseButton={false}
        className="w-[min(720px,calc(100vw-2rem))] !max-w-none max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0 rounded-[var(--radius-lg)] border border-border/35 bg-background shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="shrink-0 border-b border-border/12 px-4 py-3">
          <DialogTitle className="text-[0.6875rem] font-medium tracking-[0.01em] text-foreground/82">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <ServerForm server={server} onSuccess={handleClose} onCancel={handleClose} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
