import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { JsonImportPanel } from './json-import-panel'

interface TemplateOption {
  id: string
  name: string
}

interface ServerTemplatePickerProps {
  templates: TemplateOption[]
  labelClass: string
  selectClass: string
  jsonPanelOpen: boolean
  onJsonPanelToggle: () => void
  jsonInput: string
  onJsonInputChange: (value: string) => void
  jsonError?: string
  onTemplateSelect: (templateId: string) => void
  onJsonImport: () => void
}

export function ServerTemplatePicker({
  templates,
  labelClass,
  selectClass,
  jsonPanelOpen,
  onJsonPanelToggle,
  jsonInput,
  onJsonInputChange,
  jsonError,
  onTemplateSelect,
  onJsonImport
}: ServerTemplatePickerProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2.5 sm:col-span-2">
      <div className="space-y-1.5">
        <Label className={labelClass}>{t('mcp.server.form.quickStart')}</Label>
        <Select
          onValueChange={(templateId) => {
            if (typeof templateId !== 'string' || templateId.length === 0) return
            onTemplateSelect(templateId)
          }}
        >
          <SelectTrigger size="sm" className={`w-full ${selectClass}`}>
            <SelectValue placeholder={t('mcp.server.form.template.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <JsonImportPanel
        open={jsonPanelOpen}
        onToggle={onJsonPanelToggle}
        input={jsonInput}
        onInputChange={onJsonInputChange}
        error={jsonError}
        onImport={onJsonImport}
      />
    </div>
  )
}
