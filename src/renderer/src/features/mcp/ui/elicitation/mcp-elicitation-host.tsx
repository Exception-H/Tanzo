import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  createMcpElicitationDraft,
  parseMcpElicitationSchema,
  resolveMcpElicitationDraft
} from '@/features/mcp/lib'
import * as mcpClient from '@/platform/electron/mcp-client'
import type { McpElicitResult, McpElicitationRequest } from '@/common/contracts'

function ElicitationField({
  field,
  value,
  onChange
}: {
  readonly field: {
    readonly label: string
    readonly description?: string
    readonly input: 'text' | 'number' | 'integer' | 'boolean' | 'select' | 'json'
    readonly options?: readonly string[]
  }
  readonly value: string | boolean
  readonly onChange: (value: string | boolean) => void
}) {
  const { t } = useTranslation()
  const enumValues = field.options ?? []
  const controlClass =
    'h-8 rounded-[var(--radius-md)] border-border/25 bg-muted/15 text-[0.6875rem] focus-visible:ring-1 focus-visible:ring-border/35'
  const areaClass =
    'min-h-24 rounded-[var(--radius-md)] border-border/25 bg-muted/15 text-[0.6875rem] focus-visible:ring-1 focus-visible:ring-border/35'

  return (
    <div className="space-y-1.5">
      <Label className="text-[0.6875rem] font-medium tracking-[0.01em] text-foreground/82">
        {field.label}
      </Label>
      {field.description ? (
        <p className="text-[0.625rem] leading-4 text-foreground/48">{field.description}</p>
      ) : null}
      {field.input === 'boolean' ? (
        <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border/25 bg-muted/10 px-3 py-2">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <span className="text-[0.6875rem] text-foreground/72">
            {t('mcp.elicitation.booleanLabel')}
          </span>
        </label>
      ) : enumValues.length > 0 ? (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={(nextValue) => onChange(nextValue ?? '')}
        >
          <SelectTrigger className={cn('w-full', controlClass)}>
            <SelectValue placeholder={t('common.actions.selectOption')} />
          </SelectTrigger>
          <SelectContent>
            {enumValues.map((enumValue) => (
              <SelectItem key={enumValue} value={enumValue}>
                {enumValue}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.input === 'json' ? (
        <Textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={areaClass}
          spellCheck={false}
        />
      ) : (
        <Input
          type={field.input === 'number' || field.input === 'integer' ? 'number' : 'text'}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
          step={field.input === 'integer' ? 1 : 'any'}
        />
      )}
    </div>
  )
}

export function McpElicitationHost() {
  const { t } = useTranslation()
  const [queue, setQueue] = useState<McpElicitationRequest[]>([])
  const [formState, setFormState] = useState<{
    requestId: string | null
    draft: Record<string, string | boolean>
    validationError: string | null
    isSubmitting: boolean
  }>({
    requestId: null,
    draft: {},
    validationError: null,
    isSubmitting: false
  })

  const activeRequest = queue[0] ?? null
  const schema = useMemo(
    () => parseMcpElicitationSchema(activeRequest?.requestedSchema),
    [activeRequest?.requestedSchema]
  )
  const activeRequestId = activeRequest?.requestId ?? null
  const activeForm =
    formState.requestId === activeRequestId
      ? formState
      : {
          requestId: activeRequestId,
          draft: createMcpElicitationDraft(schema),
          validationError: null,
          isSubmitting: false
        }
  const { draft, validationError, isSubmitting } = activeForm

  useEffect(() => {
    return mcpClient.onElicitationRequested((request) => {
      setQueue((current) => [...current, request])
    })
  }, [])

  async function respond(result: McpElicitResult) {
    if (!activeRequest) {
      return
    }

    setFormState({ ...activeForm, isSubmitting: true })
    try {
      await mcpClient.resolveElicitation(activeRequest.requestId, result)
      setQueue((current) => current.slice(1))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('mcp.elicitation.submitError'))
      setFormState({ ...activeForm, isSubmitting: false })
    }
  }

  async function handleAccept() {
    const { content, validation } = resolveMcpElicitationDraft(schema, draft)
    if (validation) {
      setFormState({
        ...activeForm,
        validationError: t(`mcp.elicitation.validation.${validation.kind}`, {
          field: validation.field
        })
      })
      return
    }

    await respond({
      action: 'accept',
      ...(content ? { content } : {})
    })
  }

  function handleOpenChange(open: boolean) {
    if (!open && activeRequest && !isSubmitting) {
      void respond({ action: 'cancel' })
    }
  }

  return (
    <Dialog open={Boolean(activeRequest)} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-border/35 bg-background p-0 shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="border-b border-border/12 px-4 py-3">
          <DialogTitle className="text-[0.6875rem] font-medium tracking-[0.01em] text-foreground/82">
            {t('mcp.elicitation.title')}
          </DialogTitle>
          {activeRequest ? (
            <DialogDescription className="text-[0.6875rem] leading-5 text-foreground/56">
              {t('mcp.elicitation.description', { serverName: activeRequest.serverName })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {activeRequest ? (
          <div className="space-y-4 px-4 py-4">
            <div className="rounded-[var(--radius-md)] border border-border/20 bg-muted/10 px-3 py-2.5">
              <p className="text-[0.6875rem] leading-5 text-foreground/72">
                {activeRequest.message}
              </p>
            </div>

            {schema && schema.fields.length > 0 ? (
              <div className="space-y-3">
                {schema.fields.map((field) => (
                  <ElicitationField
                    key={field.key}
                    field={field}
                    value={draft[field.key] ?? ''}
                    onChange={(value) => {
                      setFormState({
                        ...activeForm,
                        validationError: null,
                        draft: { ...draft, [field.key]: value }
                      })
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[0.6875rem] text-foreground/52">{t('mcp.elicitation.noFields')}</p>
            )}

            {validationError ? (
              <p className="text-[0.625rem] text-red-500/85">{validationError}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-border/12 pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-[var(--radius-lg)] px-3 text-[0.6875rem]"
                disabled={isSubmitting}
                onClick={() => void respond({ action: 'cancel' })}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-[var(--radius-lg)] px-3 text-[0.6875rem]"
                disabled={isSubmitting}
                onClick={() => void respond({ action: 'decline' })}
              >
                {t('mcp.elicitation.decline')}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-[var(--radius-lg)] px-3 text-[0.6875rem]"
                disabled={isSubmitting}
                onClick={() => void handleAccept()}
              >
                {t('mcp.elicitation.accept')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
