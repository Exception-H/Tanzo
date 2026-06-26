import { Save } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

interface FormFooterProps {
  isPending: boolean
  isEdit: boolean
  onCancel?: () => void
}

export function FormFooter({ isPending, isEdit, onCancel }: FormFooterProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-end gap-2 sm:col-span-2">
      {onCancel && (
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
          size="sm"
          className="h-7 rounded-[var(--radius-md)] px-3 text-[0.6875rem] tracking-[0.01em] text-foreground/52"
        >
          {t('common.actions.cancel')}
        </Button>
      )}

      <Button
        type="submit"
        disabled={isPending}
        size="sm"
        className="h-7 rounded-[var(--radius-md)] px-3 text-[0.6875rem] tracking-[0.01em] gap-1.5"
      >
        {isPending ? (
          <>
            <Spinner className="size-3.5" />
            {t('common.actions.saving')}
          </>
        ) : (
          <>
            <Save className="size-3.5" />
            {isEdit ? t('common.actions.update') : t('mcp.server.form.addServer')}
          </>
        )}
      </Button>
    </div>
  )
}
