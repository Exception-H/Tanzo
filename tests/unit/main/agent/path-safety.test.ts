import { describe, expect, it } from 'vitest'
import { TanzoValidationError } from '@shared/errors'
import { assertNonSensitivePath, isSensitivePath } from '@main/agent/security/path-safety'

describe('agent/path-safety', () => {
  it('detects sensitive shell and environment paths across separators', () => {
    expect(isSensitivePath('/home/me/.ssh/id_rsa')).toBe(true)
    expect(isSensitivePath('C:\\Users\\me\\.aws\\credentials')).toBe(true)
    expect(isSensitivePath('/workspace/.env.local')).toBe(true)
    expect(isSensitivePath('/workspace/.ENV')).toBe(true)
    expect(isSensitivePath('/workspace/.env/secret')).toBe(true)
    expect(isSensitivePath('/workspace/src/env.ts')).toBe(false)
  })

  it('throws a validation error for sensitive paths', () => {
    expect(() =>
      assertNonSensitivePath('/workspace/.env', {
        code: 'SENSITIVE_PATH',
        message: 'Refusing sensitive path'
      })
    ).toThrow(TanzoValidationError)
    expect(() =>
      assertNonSensitivePath('/workspace/src/app.ts', {
        code: 'SENSITIVE_PATH',
        message: 'Refusing sensitive path'
      })
    ).not.toThrow()
  })
})
