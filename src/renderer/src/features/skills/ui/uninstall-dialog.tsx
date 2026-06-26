import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import type { SkillSummary } from '@shared/skills'

export function UninstallDialog({
  skill,
  onOpenChange,
  onConfirm
}: {
  skill: SkillSummary | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  return (
    <AlertDialog open={Boolean(skill)} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm gap-3 rounded-lg p-4">
        <AlertDialogHeader className="gap-1">
          <AlertDialogTitle>{t('skills.uninstall.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('skills.uninstall.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-1">
          <AlertDialogCancel>{t('skills.uninstall.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t('skills.uninstall.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
