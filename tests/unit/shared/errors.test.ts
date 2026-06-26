import { describe, expect, it } from 'vitest'
import {
  decodeIpcError,
  encodeIpcError,
  ERROR_CODES,
  serializeTanzoError,
  TanzoError,
  TanzoInvariantError,
  TanzoNotFoundError,
  TanzoTimeoutError,
  TanzoValidationError
} from '@shared/errors'

describe('shared/errors', () => {
  it('preserves structured error metadata', () => {
    const cause = new Error('root')
    const error = new TanzoError('E_TEST', 'failed', {
      cause,
      recoverable: true,
      details: { id: 'abc' }
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TanzoError')
    expect(error.message).toBe('failed')
    expect(error.code).toBe('E_TEST')
    expect(error.recoverable).toBe(true)
    expect(error.details).toEqual({ id: 'abc' })
    expect(error.cause).toBe(cause)
  })

  it('uses subclass names and default recoverability consistently', () => {
    expect(new TanzoInvariantError('bad state')).toMatchObject({
      name: 'TanzoInvariantError',
      code: 'INVARIANT_VIOLATION',
      recoverable: false
    })
    expect(new TanzoValidationError('BAD_INPUT', 'bad input')).toMatchObject({
      name: 'TanzoValidationError',
      code: 'BAD_INPUT',
      recoverable: false
    })
    expect(new TanzoNotFoundError('MISSING', 'missing')).toMatchObject({
      name: 'TanzoNotFoundError',
      code: 'MISSING',
      recoverable: false
    })
  })

  it('marks timeout errors recoverable unless overridden', () => {
    expect(new TanzoTimeoutError('SLOW', 'timed out').recoverable).toBe(true)
    expect(new TanzoTimeoutError('SLOW', 'timed out', { recoverable: false }).recoverable).toBe(
      false
    )
  })

  it('exports stable shared error codes', () => {
    expect(ERROR_CODES.CHAT_CONVERSATION_NOT_FOUND).toBe('CHAT_CONVERSATION_NOT_FOUND')
    expect(ERROR_CODES.AISDK_NO_SUCH_MODEL).toBe('AISDK_NO_SUCH_MODEL')
  })

  it('round-trips TanzoError metadata across the ipc encoding boundary', () => {
    const original = new TanzoValidationError('CHAT_COMPACTION_STALE', 'conversation changed', {
      recoverable: true,
      details: { chatId: 'chat-1', expectedActiveIds: ['m1'] }
    })

    const encoded = encodeIpcError(original)
    const electronWrapped = new Error(
      `Error invoking remote method 'chat:send': Error: ${encoded.message}`
    )
    const decoded = decodeIpcError(electronWrapped)

    expect(decoded).toBeInstanceOf(TanzoError)
    expect(decoded).toMatchObject({
      code: 'CHAT_COMPACTION_STALE',
      message: 'conversation changed',
      recoverable: true,
      details: { chatId: 'chat-1', expectedActiveIds: ['m1'] }
    })
  })

  it('serializes plain errors with the unexpected-error code', () => {
    expect(serializeTanzoError(new Error('boom'))).toEqual({
      code: 'UNEXPECTED_ERROR',
      message: 'boom',
      recoverable: false
    })
    expect(serializeTanzoError('weird')).toEqual({
      code: 'UNEXPECTED_ERROR',
      message: 'weird',
      recoverable: false
    })
  })

  it('drops non-serializable details instead of failing encoding', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const error = new TanzoError('E_TEST', 'failed', { details: circular })

    const decoded = decodeIpcError(encodeIpcError(error))
    expect(decoded).toMatchObject({ code: 'E_TEST', message: 'failed' })
    expect(decoded?.details).toBeUndefined()
  })

  it('returns null when decoding non-encoded errors', () => {
    expect(decodeIpcError(new Error('plain failure'))).toBeNull()
    expect(decodeIpcError(undefined)).toBeNull()
    expect(decodeIpcError(new Error('__TANZO_IPC_ERROR__:not-json'))).toBeNull()
  })
})
