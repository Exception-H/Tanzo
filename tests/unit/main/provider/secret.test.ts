import { beforeEach, describe, expect, it, vi } from 'vitest'

const safeStorage = {
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn()
}

vi.mock('electron', () => ({ safeStorage }))

describe('main/provider/secret', () => {
  beforeEach(() => {
    safeStorage.isEncryptionAvailable.mockReset()
    safeStorage.encryptString.mockReset()
    safeStorage.decryptString.mockReset()
  })

  it('uses electron safeStorage when encryption is available', async () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(true)
    safeStorage.encryptString.mockReturnValue(Buffer.from('cipher'))
    safeStorage.decryptString.mockReturnValue('plain')
    const { createSecretCodec } = await import('@main/provider/secret')
    const codec = createSecretCodec()

    expect(codec.isEncryptionAvailable()).toBe(true)
    expect(codec.encrypt('plain')).toBe(`safe:${Buffer.from('cipher').toString('base64')}`)
    expect(codec.decrypt(`safe:${Buffer.from('cipher').toString('base64')}`)).toBe('plain')
  })

  it('refuses to store plaintext by default when safeStorage is unavailable', async () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(false)
    const { createSecretCodec } = await import('@main/provider/secret')
    const codec = createSecretCodec()

    expect(() => codec.encrypt('plain')).toThrow('encryption is unavailable')
  })

  it('falls back to base64 encoding only when plaintext fallback is opted in', async () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(false)
    const { createSecretCodec } = await import('@main/provider/secret')
    const codec = createSecretCodec({ allowPlaintextFallback: true })
    const encrypted = codec.encrypt('plain')

    expect(encrypted).toBe(`plain:${Buffer.from('plain', 'utf8').toString('base64')}`)
    expect(codec.decrypt(encrypted)).toBe('plain')
  })

  it('rejects unsupported ciphertext formats and safe secrets without encryption', async () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(false)
    const { createSecretCodec } = await import('@main/provider/secret')
    const codec = createSecretCodec()

    expect(() => codec.decrypt(Buffer.from('unsupported', 'utf8').toString('base64'))).toThrow(
      'supported storage prefix'
    )
    expect(() => codec.decrypt(`safe:${Buffer.from('cipher').toString('base64')}`)).toThrow(
      'safeStorage'
    )
  })
})
