import { platform, type, release } from 'node:os'
import type { ContextSection } from '../section'
import { describeShellRuntime } from '../../shell/resolve'

export const envSection: ContextSection = {
  id: 'env',
  stability: 'stable',
  channel: 'leading-user',
  order: 0,
  render: ({ cwd }) => {
    const shellLine = `shell: ${describeShellRuntime({ platform: platform(), env: process.env })}`
    const lines = [
      '<environment>',
      `cwd: ${cwd}`,
      `platform: ${platform()}`,
      `os: ${type()} ${release()}`,
      shellLine,
      '</environment>'
    ]
    return lines.join('\n')
  }
}
