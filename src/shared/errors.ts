export interface TanzoErrorOptions {
  readonly cause?: unknown
  readonly recoverable?: boolean
  readonly details?: Readonly<Record<string, unknown>>
}

export class TanzoError extends Error {
  readonly code: string
  readonly recoverable: boolean
  readonly details?: Readonly<Record<string, unknown>>

  constructor(code: string, message: string, options: TanzoErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.code = code
    this.recoverable = options.recoverable ?? false
    this.details = options.details
  }
}

export class TanzoInvariantError extends TanzoError {
  constructor(message: string, options?: TanzoErrorOptions) {
    super('INVARIANT_VIOLATION', message, options)
  }
}

export class TanzoConfigurationError extends TanzoError {
  constructor(code: string, message: string, options?: TanzoErrorOptions) {
    super(code, message, options)
  }
}

export class TanzoValidationError extends TanzoError {
  constructor(code: string, message: string, options?: TanzoErrorOptions) {
    super(code, message, options)
  }
}

export class TanzoNotFoundError extends TanzoError {
  constructor(code: string, message: string, options?: TanzoErrorOptions) {
    super(code, message, options)
  }
}

export class TanzoOperationError extends TanzoError {
  constructor(code: string, message: string, options?: TanzoErrorOptions) {
    super(code, message, options)
  }
}

export class TanzoIntegrationError extends TanzoError {
  constructor(code: string, message: string, options?: TanzoErrorOptions) {
    super(code, message, options)
  }
}

export class TanzoAuthError extends TanzoError {
  constructor(code: string, message: string, options?: TanzoErrorOptions) {
    super(code, message, options)
  }
}

export class TanzoTimeoutError extends TanzoError {
  constructor(code: string, message: string, options?: TanzoErrorOptions) {
    super(code, message, { ...options, recoverable: options?.recoverable ?? true })
  }
}

export const ERROR_CODES = {
  CHAT_RUN_NOT_FOUND: 'CHAT_RUN_NOT_FOUND',
  CHAT_RUN_ALREADY_FINISHED: 'CHAT_RUN_ALREADY_FINISHED',
  CHAT_RUN_CANCELLED: 'CHAT_RUN_CANCELLED',
  CHAT_CONVERSATION_NOT_FOUND: 'CHAT_CONVERSATION_NOT_FOUND',
  CHAT_COMPACTION_STALE: 'CHAT_COMPACTION_STALE',
  CHAT_RUN_FAILED: 'CHAT_RUN_FAILED',
  CHAT_BACKLOG_GAP: 'CHAT_BACKLOG_GAP',
  CHAT_PROTOCOL_VERSION_UNSUPPORTED: 'CHAT_PROTOCOL_VERSION_UNSUPPORTED',
  RUNTIME_WORKER_CRASHED: 'RUNTIME_WORKER_CRASHED',
  RUNTIME_BROKER_TIMEOUT: 'RUNTIME_BROKER_TIMEOUT',
  RUNTIME_RUN_NOT_FOUND: 'RUNTIME_RUN_NOT_FOUND',
  AGENT_DEFINITION_NOT_FOUND: 'AGENT_DEFINITION_NOT_FOUND',
  AGENT_PREPARE_FAILED: 'AGENT_PREPARE_FAILED',
  POLICY_RULESET_NOT_FOUND: 'POLICY_RULESET_NOT_FOUND',
  POLICY_RULE_INVALID: 'POLICY_RULE_INVALID',
  DATABASE_OPEN_FAILED: 'DATABASE_OPEN_FAILED',
  DATABASE_MIGRATION_FAILED: 'DATABASE_MIGRATION_FAILED',
  DATABASE_BACKUP_FAILED: 'DATABASE_BACKUP_FAILED',
  AISDK_API_CALL_ERROR: 'AISDK_API_CALL_ERROR',
  AISDK_INVALID_RESPONSE: 'AISDK_INVALID_RESPONSE',
  AISDK_NO_SUCH_MODEL: 'AISDK_NO_SUCH_MODEL',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR'
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export interface SerializedTanzoError {
  code: string
  message: string
  recoverable: boolean
  details?: Record<string, unknown>
}

const IPC_ERROR_MARKER = '__TANZO_IPC_ERROR__:'

function sanitizeDetails(
  details: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> | undefined {
  if (!details) return undefined
  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>
  } catch {
    return undefined
  }
}

export function serializeTanzoError(error: unknown): SerializedTanzoError {
  if (error instanceof TanzoError) {
    const details = sanitizeDetails(error.details)
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      ...(details ? { details } : {})
    }
  }
  return {
    code: ERROR_CODES.UNEXPECTED_ERROR,
    message: error instanceof Error ? error.message : String(error),
    recoverable: false
  }
}

export function restoreTanzoError(serialized: SerializedTanzoError): TanzoError {
  return new TanzoError(serialized.code, serialized.message, {
    recoverable: serialized.recoverable,
    ...(serialized.details ? { details: serialized.details } : {})
  })
}

export function encodeIpcError(error: unknown): Error {
  return new Error(`${IPC_ERROR_MARKER}${JSON.stringify(serializeTanzoError(error))}`)
}

export function decodeIpcError(error: unknown): TanzoError | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const index = message.indexOf(IPC_ERROR_MARKER)
  if (index === -1) return null
  try {
    const payload = JSON.parse(
      message.slice(index + IPC_ERROR_MARKER.length)
    ) as SerializedTanzoError
    if (typeof payload?.code !== 'string' || typeof payload?.message !== 'string') return null
    return restoreTanzoError(payload)
  } catch {
    return null
  }
}
