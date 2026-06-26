import { useTranslation } from 'react-i18next'
import type { ComponentProps } from 'react'
import { Loader2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, ...props }: ComponentProps<'svg'>) {
  const { t } = useTranslation()
  return (
    <Loader2Icon
      role="status"
      aria-label={t('common.status.loading')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}
