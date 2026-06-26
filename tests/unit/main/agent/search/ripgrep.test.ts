import { describe, expect, it } from 'vitest'
import { resolveAsarUnpackedRipgrepPath } from '@main/agent/search/ripgrep'

describe('main/agent/search/ripgrep', () => {
  it('uses the unpacked binary path for packaged asar resources', () => {
    const packed = '/Applications/Tanzo.app/Contents/Resources/app.asar/node_modules/@vscode/rg'
    const unpacked =
      '/Applications/Tanzo.app/Contents/Resources/app.asar.unpacked/node_modules/@vscode/rg'

    expect(resolveAsarUnpackedRipgrepPath(packed, (path) => path === unpacked)).toBe(unpacked)
  })

  it('falls back to the original path when the unpacked binary is unavailable', () => {
    const packed = '/Applications/Tanzo.app/Contents/Resources/app.asar/node_modules/@vscode/rg'

    expect(resolveAsarUnpackedRipgrepPath(packed, () => false)).toBe(packed)
  })
})
