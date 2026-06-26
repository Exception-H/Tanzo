import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FileJson, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface JsonImportPanelProps {
  open: boolean
  onToggle: () => void
  input: string
  onInputChange: (value: string) => void
  error?: string
  onImport: () => void
}

export function JsonImportPanel({
  open,
  onToggle,
  input,
  onInputChange,
  error,
  onImport
}: JsonImportPanelProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 text-[0.6875rem] tracking-[0.01em] font-medium text-foreground/52 transition-colors hover:text-foreground/72"
      >
        <FileJson className="size-3" />
        {t('mcp.server.form.import.action')}
        <ChevronDown
          className={cn('size-3 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="space-y-1.5">
          <Textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={t('mcp.server.form.import.placeholder')}
            rows={5}
            className="font-mono text-[0.6875rem] tracking-[0.01em] rounded-[var(--radius-md)] bg-muted/15 border-border/25 focus-visible:ring-1 focus-visible:ring-border/35 placeholder:text-foreground/40"
          />
          {error && <p className="text-[0.6875rem] text-red-500/78">{error}</p>}
          <Button
            type="button"
            size="sm"
            onClick={onImport}
            disabled={!input.trim()}
            className="h-7 rounded-[var(--radius-md)] px-3 text-[0.6875rem] tracking-[0.01em]"
          >
            {t('common.actions.import')}
          </Button>
        </div>
      )}
    </div>
  )
}
