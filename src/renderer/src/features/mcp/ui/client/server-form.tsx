import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { McpServerConfig, McpTransportType } from '@/common/contracts'
import { FormFooter } from './server-form/form-footer'
import { ServerTemplatePicker } from './server-form/server-template-picker'
import { HttpFields, StdioFields } from './server-form/transport-fields'
import { useServerFormState } from './server-form/use-server-form-state'

interface ServerFormProps {
  server?: McpServerConfig
  onSuccess?: () => void
  onCancel?: () => void
}

export function ServerForm({ server, onSuccess, onCancel }: ServerFormProps) {
  const { t } = useTranslation()
  const {
    formData,
    setFormData,
    isPending,
    templates,
    jsonInput,
    setJsonInput,
    jsonError,
    setJsonError,
    jsonDialogOpen,
    setJsonDialogOpen,
    handleTemplateSelect,
    handleJsonImport,
    handleSubmit
  } = useServerFormState({ server, onSuccess })
  const panelClass = 'grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2'
  const labelClass = 'text-[0.6875rem] leading-4 font-medium tracking-[0.01em] text-foreground/82'
  const inputClass =
    'h-7 text-[0.6875rem] tracking-[0.01em] rounded-[var(--radius-md)] bg-muted/15 border-border/25 focus-visible:ring-1 focus-visible:ring-border/35 placeholder:text-foreground/40'
  const selectClass =
    '!h-7 py-0.5 text-[0.6875rem] tracking-[0.01em] rounded-[var(--radius-md)] bg-muted/15 border-border/25 focus-visible:ring-1 focus-visible:ring-border/35'
  const textareaClass =
    'text-[0.6875rem] tracking-[0.01em] rounded-[var(--radius-md)] bg-muted/15 border-border/25 focus-visible:ring-1 focus-visible:ring-border/35 placeholder:text-foreground/40 resize-none'
  const helperClass = 'text-[0.6875rem] text-foreground/40'

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      <div className={panelClass}>
        {!server && (
          <ServerTemplatePicker
            templates={templates}
            labelClass={labelClass}
            selectClass={selectClass}
            jsonPanelOpen={jsonDialogOpen}
            onJsonPanelToggle={() => {
              const next = !jsonDialogOpen
              setJsonDialogOpen(next)
              if (!next) {
                setJsonError('')
              }
            }}
            jsonInput={jsonInput}
            onJsonInputChange={setJsonInput}
            jsonError={jsonError}
            onTemplateSelect={handleTemplateSelect}
            onJsonImport={handleJsonImport}
          />
        )}

        <div className="space-y-1.5">
          <Label htmlFor="transport" className={labelClass}>
            {t('mcp.server.form.transport')} <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.transport}
            onValueChange={(value) => {
              if (!value) return
              setFormData((prev) => ({ ...prev, transport: value as McpTransportType }))
            }}
          >
            <SelectTrigger id="transport" size="sm" className={cn('w-full', selectClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stdio">{t('mcp.transport.stdio')}</SelectItem>
              <SelectItem value="sse">{t('mcp.transport.sse')}</SelectItem>
              <SelectItem value="http">{t('mcp.transport.http')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name" className={labelClass}>
            {t('mcp.server.form.name.label')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t('mcp.server.form.name.placeholder')}
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description" className={labelClass}>
            {t('mcp.server.form.description.label')}
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder={t('mcp.server.form.description.placeholder')}
            rows={2}
            className={textareaClass}
          />
        </div>

        {formData.transport === 'stdio' && (
          <StdioFields
            formData={formData}
            setFormData={setFormData}
            labelClass={labelClass}
            inputClass={inputClass}
            textareaClass={textareaClass}
            helperClass={helperClass}
          />
        )}

        {(formData.transport === 'sse' || formData.transport === 'http') && (
          <HttpFields
            formData={formData}
            setFormData={setFormData}
            labelClass={labelClass}
            inputClass={inputClass}
            textareaClass={textareaClass}
            helperClass={helperClass}
          />
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="env" className={labelClass}>
            {t('mcp.server.form.env.label')}
          </Label>
          <Textarea
            id="env"
            value={formData.env}
            onChange={(event) => setFormData((prev) => ({ ...prev, env: event.target.value }))}
            placeholder={t('mcp.server.form.env.placeholder')}
            rows={2}
            className={`${textareaClass} font-mono`}
          />
        </div>

        <div className={cn('sm:col-span-2')}>
          <FormFooter isPending={isPending} isEdit={Boolean(server)} onCancel={onCancel} />
        </div>
      </div>
    </form>
  )
}
