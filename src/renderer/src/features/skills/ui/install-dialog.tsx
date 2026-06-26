import { useState } from 'react'
import { Download, FolderOpen, PackagePlus, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { InstallSkillInput, SkillInstallScope } from '@shared/skills'
import { systemClient } from '@/platform/electron/system-client'

export function InstallDialog({
  open,
  installing,
  onOpenChange,
  onInstall
}: {
  open: boolean
  installing: boolean
  onOpenChange: (open: boolean) => void
  onInstall: (input: InstallSkillInput) => Promise<void>
}): React.ReactElement {
  const { t } = useTranslation()
  const [scope, setScope] = useState<SkillInstallScope>('user')
  const [sourcePath, setSourcePath] = useState('')
  const [enableAfterInstall, setEnableAfterInstall] = useState(true)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chooseLocalPath = async (): Promise<void> => {
    try {
      const picked = await systemClient.pickDirectory({
        title: t('skills.install.directory.label')
      })
      if (picked) {
        setSourcePath(picked)
        setError(null)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('skills.install.errors.chooseDir'))
    }
  }

  const install = async (): Promise<void> => {
    const trimmed = sourcePath.trim()
    if (!trimmed) {
      setError(t('skills.install.errors.chooseFirst'))
      return
    }
    setError(null)
    try {
      await onInstall({
        sourcePath: trimmed,
        scope,
        enableAfterInstall,
        replace: replaceExisting
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('skills.install.errors.installFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] w-[calc(100vw-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-lg p-0">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <PackagePlus className="size-5 text-muted-foreground" />
            {t('skills.install.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section className="space-y-1.5">
            <Label>{t('skills.install.directory.label')}</Label>
            <div className="flex gap-2 max-sm:flex-col">
              <Input
                value={sourcePath}
                onChange={(event) => {
                  setSourcePath(event.target.value)
                  setError(null)
                }}
                placeholder={t('skills.install.directory.placeholder')}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={chooseLocalPath}
              >
                <FolderOpen />
                {t('skills.install.directory.choose')}
              </Button>
            </div>
            <p className="text-[0.6875rem] text-muted-foreground">
              {t('skills.install.directory.hint')}
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('skills.install.scope.label')}</Label>
              <Select
                value={scope}
                onValueChange={(value) => setScope(value === 'workspace' ? 'workspace' : 'user')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('skills.install.scope.user')}</SelectItem>
                  <SelectItem value="workspace">{t('skills.install.scope.workspace')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 py-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-muted-foreground" />
                {t('skills.install.options.label')}
              </div>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={enableAfterInstall}
                  onCheckedChange={(checked) => setEnableAfterInstall(Boolean(checked))}
                  aria-label={t('skills.install.options.enableAfterInstall')}
                />
                <span className="text-xs font-medium">
                  {t('skills.install.options.enableAfterInstall')}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={replaceExisting}
                  onCheckedChange={(checked) => setReplaceExisting(Boolean(checked))}
                  aria-label={t('skills.install.options.replaceExisting')}
                />
                <span className="text-xs font-medium">
                  {t('skills.install.options.replaceExisting')}
                </span>
              </label>
            </div>
          </section>

          {error ? (
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </pre>
          ) : null}
        </div>

        <DialogFooter className="px-4 pb-4 pt-2">
          <Button type="button" className="min-w-24" onClick={install} disabled={installing}>
            <Download />
            {t('skills.install.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
