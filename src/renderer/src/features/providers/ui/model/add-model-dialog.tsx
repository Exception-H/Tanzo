import { useState, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  ModelFamily,
  ProviderFamilyModel,
  ProviderId,
  StoredProviderModel
} from '@/common/contracts'
import { useAddCustomProviderModel, useSaveProviderModelState } from '../../model'

interface AddModelDialogProps {
  providerId: ProviderId
  family: ModelFamily
  model?: StoredProviderModel
  triggerElement?: ReactElement
  children?: ReactNode
}

const FIELD_CONTROL_CLASS = 'h-9 rounded-[var(--radius-lg)] text-sm'

export function AddModelDialog({
  providerId,
  family,
  model,
  triggerElement,
  children
}: AddModelDialogProps) {
  const { t } = useTranslation()
  const addModel = useAddCustomProviderModel(providerId)
  const saveModelState = useSaveProviderModelState(providerId)
  const [open, setOpen] = useState(false)
  const [modelId, setModelId] = useState(model?.id ?? '')
  const [name, setName] = useState(model?.name ?? '')
  const [contextWindow, setContextWindow] = useState(
    model?.contextWindow ? String(model.contextWindow) : ''
  )
  const [maxOutput, setMaxOutput] = useState(model?.maxOutput ? String(model.maxOutput) : '')

  const isEditing = Boolean(model)
  const mutation = isEditing ? saveModelState : addModel

  function reset() {
    setModelId(model?.id ?? '')
    setName(model?.name ?? '')
    setContextWindow(model?.contextWindow ? String(model.contextWindow) : '')
    setMaxOutput(model?.maxOutput ? String(model.maxOutput) : '')
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    reset()
  }

  function parsePositiveInt(value: string): number | null {
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  function handleSubmit() {
    const trimmedId = modelId.trim()
    if (!trimmedId) return

    const parsedContext = family === 'language' ? parsePositiveInt(contextWindow) : null
    const parsedMaxOutput = family === 'language' ? parsePositiveInt(maxOutput) : null
    if (family === 'language' && (!parsedContext || !parsedMaxOutput)) return

    const nextModel: ProviderFamilyModel = {
      id: trimmedId,
      name: name.trim() || trimmedId,
      ...(family === 'language'
        ? {
            contextWindow: parsedContext ?? undefined,
            maxOutput: parsedMaxOutput ?? undefined
          }
        : {})
    }

    mutation.mutate(
      isEditing
        ? {
            family,
            modelId: trimmedId,
            model: nextModel,
            isCustom: model?.isCustom
          }
        : {
            family,
            modelId: trimmedId,
            model: nextModel
          },
      { onSuccess: () => handleOpenChange(false) }
    )
  }

  const languageFieldsValid =
    family !== 'language' ||
    (parsePositiveInt(contextWindow) !== null && parsePositiveInt(maxOutput) !== null)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          triggerElement ?? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-xl px-2.5 text-[0.6875rem]"
            />
          )
        }
      >
        {triggerElement ? (
          children
        ) : (
          <>
            <Plus className="size-3.5" />
            {t('providers.models.add.button')}
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('providers.models.edit.title') : t('providers.models.add.title')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('providers.models.edit.description')
              : t('providers.models.add.description')}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-model-id">{t('providers.models.add.fields.id.label')}</Label>
            <Input
              id="add-model-id"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              placeholder={t('providers.models.add.fields.id.placeholder')}
              className={`${FIELD_CONTROL_CLASS} font-mono`}
              autoFocus
              disabled={isEditing}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-model-name">{t('providers.models.add.fields.name.label')}</Label>
            <Input
              id="add-model-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('providers.models.add.fields.name.placeholder')}
              className={FIELD_CONTROL_CLASS}
            />
          </div>

          {family === 'language' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-model-context">
                  {t('providers.models.add.fields.contextWindow.label')}
                </Label>
                <Input
                  id="add-model-context"
                  type="number"
                  min={1}
                  required
                  value={contextWindow}
                  onChange={(event) => setContextWindow(event.target.value)}
                  placeholder={t('providers.models.add.fields.contextWindow.placeholder')}
                  className={`${FIELD_CONTROL_CLASS} font-mono`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-model-max-output">
                  {t('providers.models.add.fields.maxOutput.label')}
                </Label>
                <Input
                  id="add-model-max-output"
                  type="number"
                  min={1}
                  required
                  value={maxOutput}
                  onChange={(event) => setMaxOutput(event.target.value)}
                  placeholder={t('providers.models.add.fields.maxOutput.placeholder')}
                  className={`${FIELD_CONTROL_CLASS} font-mono`}
                />
              </div>
            </>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" size="sm" className="rounded-xl" />}
            >
              {t(isEditing ? 'providers.models.edit.cancel' : 'providers.models.add.cancel')}
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              className="rounded-xl"
              disabled={!modelId.trim() || !languageFieldsValid || mutation.isPending}
            >
              {t(isEditing ? 'providers.models.edit.submit' : 'providers.models.add.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
