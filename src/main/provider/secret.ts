import { safeStorage } from 'electron'
import { TanzoValidationError } from '@shared/errors'

const SAFE_PREFIX = 'safe:'
const PLAIN_PREFIX = 'plain:'

export interface SecretCodec {
  encrypt(plaintext: string): string
  decrypt(ciphertext: string): string
  isEncryptionAvailable(): boolean
}

export interface SecretCodecOptions {
  allowPlaintextFallback?: boolean
}

export function createSecretCodec(options: SecretCodecOptions = {}): SecretCodec {
  const allowPlaintextFallback = options.allowPlaintextFallback ?? false
  return {
    isEncryptionAvailable() {
      return safeStorage.isEncryptionAvailable()
    },
    encrypt(plaintext) {
      if (safeStorage.isEncryptionAvailable()) {
        return `${SAFE_PREFIX}${safeStorage.encryptString(plaintext).toString('base64')}`
      }
      if (!allowPlaintextFallback) {
        throw new TanzoValidationError(
          'PROVIDER_SECRET_ENCRYPTION_UNAVAILABLE',
          'OS secret encryption is unavailable, so the API key cannot be stored securely. Enable a system keyring or opt in to plaintext storage.'
        )
      }
      return `${PLAIN_PREFIX}${Buffer.from(plaintext, 'utf8').toString('base64')}`
    },
    decrypt(ciphertext) {
      if (ciphertext.startsWith(SAFE_PREFIX)) {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('Secret was encrypted with safeStorage, but encryption is unavailable.')
        }
        return safeStorage.decryptString(
          Buffer.from(ciphertext.slice(SAFE_PREFIX.length), 'base64')
        )
      }
      if (ciphertext.startsWith(PLAIN_PREFIX)) {
        return Buffer.from(ciphertext.slice(PLAIN_PREFIX.length), 'base64').toString('utf8')
      }

      throw new Error('Secret ciphertext is missing a supported storage prefix.')
    }
  }
}
