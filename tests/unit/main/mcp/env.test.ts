import { afterEach, describe, expect, it, vi } from 'vitest'
import { expandEnvVarsInString, expandMcpServerConfig, normalizeStdioEnv } from '@main/mcp/env'

describe('main/mcp/env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('expands environment variables with defaults and tracks missing names', () => {
    vi.stubEnv('TANZO_TEST_VAR', 'value')

    expect(expandEnvVarsInString('${TANZO_TEST_VAR}/${MISSING:-fallback}/${ALSO_MISSING}')).toEqual(
      {
        expanded: 'value/fallback/${ALSO_MISSING}',
        missingVars: ['ALSO_MISSING']
      }
    )
  })

  it('expands every configurable MCP server field', () => {
    vi.stubEnv('ROOT', '/tmp/root')

    expect(
      expandMcpServerConfig({
        name: 'fs',
        transport: 'stdio',
        command: '${ROOT}/server',
        args: ['--cwd=${ROOT}'],
        cwd: '${ROOT}',
        url: 'https://${HOST:-example.test}',
        headers: { 'X-${ROOT}': '${ROOT}' },
        env: { ROOT: '${ROOT}' },
        enabled: true
      })
    ).toMatchObject({
      command: '/tmp/root/server',
      args: ['--cwd=/tmp/root'],
      cwd: '/tmp/root',
      url: 'https://example.test',
      headers: { 'X-/tmp/root': '/tmp/root' },
      env: { ROOT: '/tmp/root' }
    })
  })

  it('inherits non-sensitive process env, strips secrets, and applies overrides', () => {
    vi.stubEnv('PATH', '/bin')
    vi.stubEnv('SECRET_TOKEN', 'present')

    const env = normalizeStdioEnv({ CUSTOM: 'yes' })
    expect(env).toMatchObject({ PATH: '/bin', CUSTOM: 'yes' })
    expect(env).not.toHaveProperty('SECRET_TOKEN')
  })

  it('keeps an explicitly declared override even when its name looks sensitive', () => {
    vi.stubEnv('PATH', '/bin')

    expect(normalizeStdioEnv({ MY_API_KEY: 'declared' })).toMatchObject({
      PATH: '/bin',
      MY_API_KEY: 'declared'
    })
  })

  it('does not expand secrets into remote transport url or headers', () => {
    vi.stubEnv('PUBLIC_HOST', 'api.example.test')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'super-secret')
    vi.stubEnv('GITHUB_TOKEN', 'ghp_secret')

    const expanded = expandMcpServerConfig({
      name: 'remote',
      transport: 'sse',
      url: 'https://${PUBLIC_HOST}/${AWS_SECRET_ACCESS_KEY}',
      headers: { Authorization: 'Bearer ${GITHUB_TOKEN}', 'X-Env': '${PUBLIC_HOST}' },
      enabled: true
    })

    expect(expanded.url).toBe('https://api.example.test/${AWS_SECRET_ACCESS_KEY}')
    expect(expanded.headers).toMatchObject({
      Authorization: 'Bearer ${GITHUB_TOKEN}',
      'X-Env': 'api.example.test'
    })
    expect(JSON.stringify(expanded)).not.toContain('super-secret')
    expect(JSON.stringify(expanded)).not.toContain('ghp_secret')
  })

  it('still expands secrets into local stdio env/args (sanitized separately by safeChildEnv)', () => {
    vi.stubEnv('MY_TOKEN', 'tok')

    const expanded = expandMcpServerConfig({
      name: 'local',
      transport: 'stdio',
      command: 'server',
      args: ['--token=${MY_TOKEN}'],
      env: { TOKEN: '${MY_TOKEN}' },
      enabled: true
    })

    expect(expanded.args).toEqual(['--token=tok'])
    expect(expanded.env).toMatchObject({ TOKEN: 'tok' })
  })

  it('replaces Windows env keys case-insensitively when overriding', () => {
    vi.stubEnv('Path', 'C:\\Windows\\System32')

    const env = normalizeStdioEnv({ PATH: 'D:\\npm-bin' })

    if (process.platform === 'win32') {
      expect(env).toHaveProperty('PATH', 'D:\\npm-bin')
      expect(env).not.toHaveProperty('Path')
      return
    }

    expect(env).toMatchObject({
      Path: 'C:\\Windows\\System32',
      PATH: 'D:\\npm-bin'
    })
  })
})
