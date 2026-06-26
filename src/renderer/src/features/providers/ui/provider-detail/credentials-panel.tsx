import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Plus,
  RotateCw,
  Save,
  ShieldAlert,
  Trash2,
  X
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { CredentialField, ProviderKeySummary, ProviderWorkspace } from '@/common/contracts'
import {
  useAddProviderKey,
  useDeleteProviderKey,
  useProviderKeys,
  useSaveProviderConnection,
  useSetActiveProviderKey,
  useTestProviderConnection
} from '../../model'
import { FloatingSaveBar } from './floating-save-bar'
import { ProviderSectionCard } from './provider-section'
import {
  PROVIDER_CONTROL_CLASS,
  PROVIDER_FIELD_ROW_CLASS,
  PROVIDER_LABEL_CLASS,
  PROVIDER_SUMMARY_PILL_CLASS
} from './provider-section-styles'

const EMPTY_KEYS: ProviderKeySummary[] = []

interface CredentialsPanelProps {
  workspace: ProviderWorkspace
}

function publicFields(fields: CredentialField[]): CredentialField[] {
  return fields.filter((field) => field.key !== 'apiKey')
}

function initialValues(workspace: ProviderWorkspace): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of publicFields(workspace.provider.credentialFields)) {
    values[field.key] = workspace.connection.formValues[field.key] ?? ''
  }
  return values
}

function valuesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if ((a[key] ?? '') !== (b[key] ?? '')) return false
  }
  return true
}

export function CredentialsPanel({ workspace }: CredentialsPanelProps) {
  const { t } = useTranslation()
  const providerId = workspace.provider.id
  const baseline = useMemo(() => initialValues(workspace), [workspace])
  const baselineKey = useMemo(() => JSON.stringify(baseline), [baseline])
  const [formState, setFormState] = useState<{
    key: string
    values: Record<string, string>
    saveStatus: 'idle' | 'saving' | 'success' | 'error'
  }>({ key: baselineKey, values: baseline, saveStatus: 'idle' })
  const [showFields, setShowFields] = useState<Record<string, boolean>>({})
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [newApiKeyVisible, setNewApiKeyVisible] = useState(false)

  const keysQuery = useProviderKeys(providerId)
  const saveConnection = useSaveProviderConnection()
  const testConnection = useTestProviderConnection(providerId)
  const addKey = useAddProviderKey(providerId)
  const deleteKey = useDeleteProviderKey(providerId)
  const setActiveKey = useSetActiveProviderKey(providerId)
  const keys = keysQuery.data ?? EMPTY_KEYS
  const activeKey = useMemo(() => keys.find((key) => key.active), [keys])
  const fields = publicFields(workspace.provider.credentialFields)
  const hasApiKeyField = workspace.provider.credentialFields.some((field) => field.key === 'apiKey')
  const values = formState.key === baselineKey ? formState.values : baseline
  const saveStatus = formState.key === baselineKey ? formState.saveStatus : 'idle'

  useEffect(() => {
    if (saveStatus !== 'success' && saveStatus !== 'error') return
    const timer = setTimeout(() => {
      setFormState((current) =>
        current.key === baselineKey ? { ...current, saveStatus: 'idle' } : current
      )
    }, 2200)
    return () => clearTimeout(timer)
  }, [baselineKey, saveStatus])

  const hasChanges = !valuesEqual(values, baseline)
  const changeCount = Object.keys(values).reduce(
    (acc, key) => acc + (values[key] !== (baseline[key] ?? '') ? 1 : 0),
    0
  )
  const hasCredentials = workspace.connection.status !== 'disconnected'
  const canTestConnection = hasCredentials || hasChanges
  const connectionActionPending = saveConnection.isPending || testConnection.isPending

  function handleFieldChange(key: string, value: string) {
    setFormState({
      key: baselineKey,
      values: { ...values, [key]: value },
      saveStatus: 'idle'
    })
  }

  function toggleVisibility(key: string) {
    setShowFields((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function saveDraftIfNeeded(): Promise<boolean> {
    if (!hasChanges) return true

    const draftValues = values
    setFormState({ key: baselineKey, values: draftValues, saveStatus: 'saving' })
    try {
      await saveConnection.mutateAsync({ providerId, credentials: draftValues })
      setFormState({ key: baselineKey, values: draftValues, saveStatus: 'success' })
      return true
    } catch {
      setFormState({ key: baselineKey, values: draftValues, saveStatus: 'error' })
      return false
    }
  }

  async function handleTestConnection() {
    if (!(await saveDraftIfNeeded())) return
    testConnection.mutate()
  }

  function handleSave() {
    if (!hasChanges) return
    setFormState({ key: baselineKey, values, saveStatus: 'saving' })
    saveConnection.mutate(
      { providerId, credentials: values },
      {
        onSuccess: () => setFormState({ key: baselineKey, values, saveStatus: 'success' }),
        onError: () => setFormState({ key: baselineKey, values, saveStatus: 'error' })
      }
    )
  }

  function handleCancel() {
    setFormState({ key: baselineKey, values: baseline, saveStatus: 'idle' })
  }

  async function handleAddKey() {
    if (!(await saveDraftIfNeeded())) return
    addKey.mutate(
      { label: newKeyLabel.trim() || undefined, apiKey: newApiKey, makeActive: keys.length === 0 },
      {
        onSuccess: () => {
          setNewKeyLabel('')
          setNewApiKey('')
          setNewApiKeyVisible(false)
        }
      }
    )
  }

  async function handleSetActiveKey(keyId: string) {
    if (!(await saveDraftIfNeeded())) return
    setActiveKey.mutate(keyId)
  }

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ProviderSectionCard
        icon={Key}
        title={t('providers.credentials.connection.title')}
        description={t('providers.credentials.connection.description')}
        action={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!canTestConnection || connectionActionPending}
              className="h-7 gap-1.5 rounded-xl px-2.5 text-xs"
            >
              <RotateCw className={cn('size-3.5', connectionActionPending && 'animate-spin')} />
              {t('providers.credentials.test.button')}
            </Button>
            {!workspace.connection.encryptionAvailable ? (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="size-3" />
                {t('providers.credentials.encryption.unavailable')}
              </Badge>
            ) : null}
            <span
              className={cn(
                PROVIDER_SUMMARY_PILL_CLASS,
                hasCredentials && 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20'
              )}
            >
              {hasCredentials ? t('common.status.configured') : t('common.status.notConfigured')}
            </span>
          </>
        }
      >
        {fields.length === 0 ? (
          <div className="px-4 py-6 text-center text-[0.6875rem] text-muted-foreground">
            {t('providers.credentials.connection.apiKeyOnly')}
          </div>
        ) : (
          fields.map((field) => {
            const isPasswordField = field.type === 'password' || field.secret
            const showValue = showFields[field.key] ?? false
            const inputType =
              isPasswordField && !showValue ? 'password' : field.type === 'url' ? 'url' : 'text'

            return (
              <div key={field.key} className={PROVIDER_FIELD_ROW_CLASS}>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`${providerId}-${field.key}`} className={PROVIDER_LABEL_CLASS}>
                    {field.label}
                    {field.required ? (
                      <span className="ml-1.5 text-[0.625rem] text-destructive">*</span>
                    ) : null}
                  </Label>
                  {field.helperText ? (
                    <p className="text-[0.625rem] leading-4 text-muted-foreground">
                      {field.helperText}
                    </p>
                  ) : null}
                </div>

                <div className="w-full md:justify-self-end">
                  {field.type === 'select' ? (
                    <Select
                      value={values[field.key] ?? ''}
                      onValueChange={(value) => handleFieldChange(field.key, value ?? '')}
                    >
                      <SelectTrigger
                        id={`${providerId}-${field.key}`}
                        className={cn('w-full', PROVIDER_CONTROL_CLASS)}
                      >
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="relative">
                      <Input
                        id={`${providerId}-${field.key}`}
                        type={inputType}
                        value={values[field.key] ?? ''}
                        onChange={(event) => handleFieldChange(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        className={cn(
                          PROVIDER_CONTROL_CLASS,
                          isPasswordField && 'pr-9 font-mono tracking-tight'
                        )}
                      />
                      {isPasswordField ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleVisibility(field.key)}
                          className="absolute right-1.5 top-1/2 z-10 size-6 -translate-y-1/2 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                        >
                          {showValue ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </ProviderSectionCard>

      {hasApiKeyField ? (
        <ProviderSectionCard
          icon={KeyRound}
          title={t('providers.credentials.apiKeys.title')}
          description={t('providers.credentials.apiKeys.description')}
          action={
            activeKey ? (
              <span className={cn(PROVIDER_SUMMARY_PILL_CLASS, 'gap-1.5')}>
                <CheckCircle2 className="size-3 text-emerald-500" />
                <span className="max-w-[140px] truncate">{activeKey.label}</span>
              </span>
            ) : undefined
          }
        >
          {keys.length === 0 ? (
            <div className="px-4 py-8 text-center text-[0.75rem] text-muted-foreground">
              {t('providers.credentials.apiKeys.empty')}
            </div>
          ) : (
            keys.map((key) => (
              <div
                key={key.keyId}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[0.8125rem] font-medium leading-5 text-foreground/90">
                    {key.label}
                  </span>
                  <span className="shrink-0 font-mono text-[0.625rem] leading-4 text-muted-foreground">
                    {key.maskedKey}
                  </span>
                  {key.active ? (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <CheckCircle2 className="size-3" />
                      {t('providers.credentials.apiKeys.active')}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 md:justify-self-end">
                  {!key.active ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleSetActiveKey(key.keyId)}
                      disabled={saveConnection.isPending || setActiveKey.isPending}
                      className="h-7 rounded-xl px-2.5 text-[0.6875rem]"
                    >
                      {t('providers.credentials.apiKeys.use')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => deleteKey.mutate(key.keyId)}
                    disabled={deleteKey.isPending}
                    className="size-7 rounded-xl text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_auto]">
            <Input
              value={newKeyLabel}
              onChange={(event) => setNewKeyLabel(event.target.value)}
              placeholder={t('providers.credentials.apiKeys.labelPlaceholder')}
              className={PROVIDER_CONTROL_CLASS}
            />
            <div className="relative">
              <Input
                type={newApiKeyVisible ? 'text' : 'password'}
                value={newApiKey}
                onChange={(event) => setNewApiKey(event.target.value)}
                placeholder={t('providers.credentials.fields.apiKey.label')}
                className={cn(PROVIDER_CONTROL_CLASS, 'pr-9 font-mono tracking-tight')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setNewApiKeyVisible((prev) => !prev)}
                className="absolute right-1.5 top-1/2 z-10 size-6 -translate-y-1/2 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                {newApiKeyVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddKey}
              disabled={!newApiKey.trim() || saveConnection.isPending || addKey.isPending}
              className="h-8 gap-1.5 rounded-xl px-3 text-xs"
            >
              <Plus className="size-3.5" />
              {t('providers.credentials.apiKeys.add')}
            </Button>
          </div>
        </ProviderSectionCard>
      ) : null}

      <FloatingSaveBar visible={hasChanges} changeCount={changeCount} status={saveStatus}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={saveConnection.isPending}
          className="h-8 rounded-xl px-3 text-xs"
        >
          <X className="mr-1 size-3.5" />
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saveConnection.isPending || !hasChanges}
          className="h-8 rounded-xl px-3 text-xs"
        >
          {saveConnection.isPending || saveStatus === 'saving' ? (
            <Spinner className="mr-1 size-3.5" />
          ) : saveStatus === 'success' ? (
            <CheckCircle2 className="mr-1 size-3.5" />
          ) : (
            <Save className="mr-1 size-3.5" />
          )}
          {saveStatus === 'success' ? t('common.actions.saved') : t('common.actions.save')}
        </Button>
      </FloatingSaveBar>
    </div>
  )
}
