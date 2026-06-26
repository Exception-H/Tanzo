import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SERVER_TEMPLATES } from '@/features/mcp/config'
import { useCreateServer, useUpdateServer } from '@/features/mcp/model'
import { toTranslationKeySegment } from '@/lib/i18n-key'
import { isRecord } from '@/common/lib/type-guards'
import type {
  McpHttpRedirectMode,
  McpServerConfig,
  McpTransportType,
  ServerTemplate
} from '@/common/contracts'

export interface ServerFormDataState {
  name: string
  description: string
  command: string
  args: string
  cwd: string
  env: string
  transport: McpTransportType
  url: string
  headers: string
  redirect: McpHttpRedirectMode
}

interface UseServerFormStateOptions {
  server?: McpServerConfig
  onSuccess?: () => void
}

interface LocalizedTemplate extends ServerTemplate {
  name: string
  description: string
}

function normalizeTransport(value: unknown): McpTransportType | null {
  if (value === 'stdio' || value === 'sse' || value === 'http') {
    return value
  }
  return null
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeJsonField(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function formatArgsField(args: readonly string[] | undefined): string {
  if (!args || args.length === 0) return ''
  return JSON.stringify(args, null, 2)
}

export function useServerFormState({ server, onSuccess }: UseServerFormStateOptions) {
  const { t } = useTranslation()
  const createServer = useCreateServer()
  const updateServer = useUpdateServer()

  const [formData, setFormData] = useState<ServerFormDataState>({
    name: server?.name || '',
    description: server?.description || '',
    command: server?.command || '',
    args: formatArgsField(server?.args),
    cwd: server?.cwd || '',
    env: server?.env ? JSON.stringify(server.env, null, 2) : '',
    transport: (server?.transport || 'stdio') as McpTransportType,
    url: server?.url || '',
    headers: server?.headers ? JSON.stringify(server.headers, null, 2) : '',
    redirect: server?.redirect || 'follow'
  })

  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false)

  const templates = useMemo<LocalizedTemplate[]>(
    () =>
      SERVER_TEMPLATES.map((template) => {
        const templateKey = toTranslationKeySegment(template.id)

        return {
          ...template,
          name: t(`mcp.server.templates.${templateKey}.name`),
          description: t(`mcp.server.templates.${templateKey}.description`)
        }
      }),
    [t]
  )

  const isPending = createServer.isPending || updateServer.isPending

  function handleTemplateSelect(templateId: string) {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    setFormData({
      name: template.name,
      description: template.description,
      command: 'command' in template ? template.command || '' : '',
      args: 'args' in template ? formatArgsField(template.args) : '',
      cwd: 'cwd' in template ? template.cwd || '' : '',
      env: '',
      transport: template.transport,
      url: 'url' in template ? template.url || '' : '',
      headers:
        'headers' in template && template.headers ? JSON.stringify(template.headers, null, 2) : '',
      redirect: 'redirect' in template && template.redirect ? template.redirect : 'follow'
    })
  }

  function handleJsonImport() {
    setJsonError('')
    try {
      const parsed = JSON.parse(jsonInput)
      if (!isRecord(parsed)) {
        setJsonError(t('mcp.server.form.errors.invalidJson'))
        return
      }
      let serverConfig = parsed
      if (isRecord(parsed.mcpServers)) {
        const servers = parsed.mcpServers
        const keys = Object.keys(servers)
        if (keys.length >= 1) {
          const serverName = keys[0]
          if (serverName && isRecord(servers[serverName])) {
            serverConfig = { name: serverName, ...servers[serverName] }
          }
        }
      } else if (!parsed.command && !parsed.url) {
        const keys = Object.keys(parsed)
        if (keys.length === 1) {
          const serverName = keys[0]
          if (serverName && isRecord(parsed[serverName])) {
            serverConfig = { name: serverName, ...parsed[serverName] }
          }
        }
      }
      const explicitTransport = normalizeTransport(serverConfig.transport)
      const importedUrl = normalizeString(serverConfig.url)
      let transport: McpTransportType = explicitTransport ?? 'stdio'
      if (!explicitTransport && importedUrl) {
        transport = importedUrl.includes('/sse') ? 'sse' : 'http'
      }
      setFormData({
        name: normalizeString(serverConfig.name),
        description: normalizeString(serverConfig.description),
        command: normalizeString(serverConfig.command),
        args: Array.isArray(serverConfig.args)
          ? formatArgsField(serverConfig.args)
          : normalizeString(serverConfig.args),
        cwd: normalizeString(serverConfig.cwd),
        env: normalizeJsonField(serverConfig.env),
        transport,
        url: importedUrl,
        headers: normalizeJsonField(serverConfig.headers),
        redirect: serverConfig.redirect === 'error' ? 'error' : 'follow'
      })
      setJsonDialogOpen(false)
      setJsonInput('')
    } catch {
      setJsonError(t('mcp.server.form.errors.invalidJson'))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (server?.id) {
      updateServer.mutate(
        {
          id: server.id,
          formData: { ...formData, enabled: server.enabled }
        },
        { onSuccess }
      )
      return
    }
    createServer.mutate({ ...formData, enabled: true }, { onSuccess })
  }

  return {
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
  }
}
