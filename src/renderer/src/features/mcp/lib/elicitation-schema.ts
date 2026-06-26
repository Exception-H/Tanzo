export type McpElicitationFieldInput = 'text' | 'number' | 'integer' | 'boolean' | 'select' | 'json'

export type McpElicitationDraftValue = string | boolean

interface JsonSchemaProperty {
  readonly type?: string | readonly string[]
  readonly title?: string
  readonly description?: string
  readonly enum?: readonly unknown[]
  readonly default?: unknown
}

interface JsonObjectSchema {
  readonly properties?: Readonly<Record<string, JsonSchemaProperty>>
  readonly required?: readonly string[]
}

export interface McpElicitationField {
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly required: boolean
  readonly input: McpElicitationFieldInput
  readonly options?: readonly string[]
  readonly defaultValue: McpElicitationDraftValue
}

export interface McpElicitationSchemaModel {
  readonly fields: readonly McpElicitationField[]
}

function getObjectSchema(value: unknown): JsonObjectSchema | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const schema = value as JsonObjectSchema
  if (!schema.properties || typeof schema.properties !== 'object') {
    return null
  }

  return schema
}

function getPropertyType(property: JsonSchemaProperty): McpElicitationFieldInput {
  const resolvedType = Array.isArray(property.type)
    ? property.type.find((candidate) => candidate !== 'null')
    : property.type

  if (resolvedType === 'string') {
    const enumValues = Array.isArray(property.enum)
      ? property.enum.filter((item): item is string => typeof item === 'string')
      : []
    return enumValues.length > 0 ? 'select' : 'text'
  }

  if (resolvedType === 'number') {
    return 'number'
  }

  if (resolvedType === 'integer') {
    return 'integer'
  }

  if (resolvedType === 'boolean') {
    return 'boolean'
  }

  return 'json'
}

function getDefaultDraftValue(
  input: McpElicitationFieldInput,
  property: JsonSchemaProperty
): McpElicitationDraftValue {
  const defaultValue = property.default

  if (input === 'boolean') {
    return typeof defaultValue === 'boolean' ? defaultValue : false
  }

  if (
    (input === 'text' || input === 'number' || input === 'integer' || input === 'select') &&
    typeof defaultValue !== 'object' &&
    defaultValue != null
  ) {
    return String(defaultValue)
  }

  if (defaultValue !== undefined) {
    return JSON.stringify(defaultValue, null, 2)
  }

  return ''
}

export function parseMcpElicitationSchema(schema: unknown): McpElicitationSchemaModel | null {
  const objectSchema = getObjectSchema(schema)
  if (!objectSchema) {
    return null
  }

  const requiredFields = new Set(objectSchema.required ?? [])
  const properties = objectSchema.properties ?? {}
  return {
    fields: Object.entries(properties).map(([key, property]) => {
      const input = getPropertyType(property)
      const options =
        input === 'select' && Array.isArray(property.enum)
          ? property.enum.filter((item): item is string => typeof item === 'string')
          : undefined

      return {
        key,
        label: property.title ?? key,
        ...(property.description ? { description: property.description } : {}),
        required: requiredFields.has(key),
        input,
        ...(options ? { options } : {}),
        defaultValue: getDefaultDraftValue(input, property)
      } satisfies McpElicitationField
    })
  }
}

export function createMcpElicitationDraft(
  schema: McpElicitationSchemaModel | null
): Record<string, McpElicitationDraftValue> {
  if (!schema) {
    return {}
  }

  return Object.fromEntries(schema.fields.map((field) => [field.key, field.defaultValue]))
}

export function resolveMcpElicitationDraft(
  schema: McpElicitationSchemaModel | null,
  draft: Record<string, McpElicitationDraftValue>
): {
  readonly content?: Record<string, unknown>
  readonly validation?:
    | { kind: 'required'; field: string }
    | { kind: 'number'; field: string }
    | { kind: 'integer'; field: string }
    | { kind: 'json'; field: string }
} {
  if (!schema) {
    return { content: {} }
  }

  const content: Record<string, unknown> = {}

  for (const field of schema.fields) {
    const value = draft[field.key]

    if (field.input === 'boolean') {
      content[field.key] = Boolean(value)
      continue
    }

    const stringValue = typeof value === 'string' ? value.trim() : ''
    if (!stringValue) {
      if (field.required) {
        return {
          validation: { kind: 'required', field: field.label }
        }
      }
      continue
    }

    if (field.input === 'number' || field.input === 'integer') {
      const numericValue = Number(stringValue)
      if (!Number.isFinite(numericValue)) {
        return {
          validation: { kind: 'number', field: field.label }
        }
      }
      if (field.input === 'integer' && !Number.isInteger(numericValue)) {
        return {
          validation: { kind: 'integer', field: field.label }
        }
      }
      content[field.key] = numericValue
      continue
    }

    if (field.input === 'json') {
      try {
        content[field.key] = JSON.parse(stringValue)
      } catch {
        return {
          validation: { kind: 'json', field: field.label }
        }
      }
      continue
    }

    content[field.key] = stringValue
  }

  return { content }
}
