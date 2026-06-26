import { spawn, type ChildProcess } from 'node:child_process'
import { platform as currentPlatform } from 'node:os'
import { resolveShellCandidates, type ShellCandidate } from '../shell/resolve'
import { safeChildEnv } from '../../safe-env'
import type { HookExecResult } from './types'

const MIN_TIMEOUT_MS = 1_000
const DEFAULT_TIMEOUT_MS = 600_000
const MAX_CAPTURE_BYTES = 1_000_000

export interface HookExecOptions {
  command: string
  commandWindows?: string
  stdin: string
  cwd: string
  timeoutSec: number
  env?: Record<string, string>
  signal?: AbortSignal
  platform?: NodeJS.Platform
}

export interface HookExecutor {
  run(options: HookExecOptions): Promise<HookExecResult>
}

function clampTimeout(timeoutSec: number): number {
  const ms = Math.round(timeoutSec * 1000)
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_TIMEOUT_MS
  return Math.max(MIN_TIMEOUT_MS, ms)
}

function pickCandidate(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): ShellCandidate {
  const candidates = resolveShellCandidates({ platform, env })
  return candidates[0]
}

function killProcessTree(child: ChildProcess, platform: NodeJS.Platform): void {
  if (child.pid === undefined || child.killed) return
  if (platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore'
    })
    return
  }
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

export function createHookExecutor(): HookExecutor {
  return {
    run(options) {
      const platform = options.platform ?? currentPlatform()
      const command =
        platform === 'win32' && options.commandWindows ? options.commandWindows : options.command
      const candidate = pickCandidate(platform, process.env)
      const childEnv = safeChildEnv(options.env, process.env)
      const timeoutMs = clampTimeout(options.timeoutSec)
      const startedAt = Date.now()

      return new Promise<HookExecResult>((resolve) => {
        let settled = false
        let timedOut = false
        let stdout = ''
        let stderr = ''
        let stdoutBytes = 0
        let stderrBytes = 0

        const child = spawn(candidate.file, candidate.args(command), {
          cwd: options.cwd,
          env: childEnv,
          detached: platform !== 'win32',
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        const finish = (result: Omit<HookExecResult, 'durationMs'>): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          options.signal?.removeEventListener('abort', onAbort)
          resolve({ ...result, durationMs: Date.now() - startedAt })
        }

        const timer = setTimeout(() => {
          timedOut = true
          killProcessTree(child, platform)
        }, timeoutMs)

        const onAbort = (): void => {
          killProcessTree(child, platform)
        }
        if (options.signal) {
          if (options.signal.aborted) {
            killProcessTree(child, platform)
          } else {
            options.signal.addEventListener('abort', onAbort, { once: true })
          }
        }

        child.stdout.on('data', (chunk: Buffer) => {
          if (stdoutBytes >= MAX_CAPTURE_BYTES) return
          stdoutBytes += chunk.length
          stdout += chunk.toString('utf8')
        })
        child.stderr.on('data', (chunk: Buffer) => {
          if (stderrBytes >= MAX_CAPTURE_BYTES) return
          stderrBytes += chunk.length
          stderr += chunk.toString('utf8')
        })

        child.on('error', (error: NodeJS.ErrnoException) => {
          const message =
            error.code === 'ENOENT'
              ? `hook shell not found: ${candidate.file}`
              : `hook failed to spawn: ${error.message}`
          finish({ exitCode: null, stdout, stderr, timedOut, error: message })
        })

        child.on('close', (code) => {
          if (timedOut) {
            finish({
              exitCode: null,
              stdout,
              stderr,
              timedOut: true,
              error: `hook timed out after ${Math.round(timeoutMs / 1000)}s`
            })
            return
          }
          finish({ exitCode: code, stdout, stderr, timedOut: false })
        })

        const stdin = child.stdin
        stdin.on('error', () => {})
        stdin.write(options.stdin, 'utf8', () => {
          stdin.end()
        })
      })
    }
  }
}
