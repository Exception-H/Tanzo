import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import type { ShellEvent, ShellRunner } from './types'
import { resolveShellCandidates, type ShellCandidate } from './resolve'
import { safeChildEnv } from '../../safe-env'

type KillReason = 'timeout' | 'abort' | 'closed'
type RunResult = 'completed' | 'missing'
type ShellProcess = ChildProcessByStdio<null, Readable, Readable>

const BACKGROUND_SHELL_STDIO: ['ignore', 'pipe', 'pipe'] = ['ignore', 'pipe', 'pipe']

const EXIT_CLOSE_GRACE_MS = 2_000

interface ShellRunnerOptions {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

interface RunCandidateOptions {
  candidate: ShellCandidate
  command: string
  cwd?: string
  childEnv: Record<string, string>
  platform: NodeJS.Platform
  getKillReason(): KillReason | null
  setKillProcessTree(killProcessTree: (() => void) | null): void
}

function codeForSignal(signal: NodeJS.Signals | null): number | undefined {
  if (!signal) return undefined
  if (signal === 'SIGINT') return 130
  if (signal === 'SIGTERM') return 143
  if (signal === 'SIGKILL') return 137
  return undefined
}

function codeForKillReason(reason: KillReason | null, fallback: number): number {
  if (reason === 'timeout') return 124
  if (reason === 'abort' || reason === 'closed') return 130
  return fallback
}

function isMissingExecutable(error: Error): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function killProcessTree(child: ShellProcess, platform: NodeJS.Platform): void {
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

async function* runCandidate({
  candidate,
  command,
  cwd,
  childEnv,
  platform,
  getKillReason,
  setKillProcessTree
}: RunCandidateOptions): AsyncGenerator<ShellEvent, RunResult> {
  const child = spawn(candidate.file, candidate.args(command), {
    cwd,
    env: childEnv,
    detached: platform !== 'win32',
    windowsHide: true,
    stdio: BACKGROUND_SHELL_STDIO
  })
  const queue: ShellEvent[] = []
  let done = false
  let result: RunResult = 'completed'
  let notify: (() => void) | null = null

  const push = (event: ShellEvent): void => {
    queue.push(event)
    const resume = notify
    notify = null
    resume?.()
  }

  const finish = (code: number, reason: ShellEvent['reason'] = getKillReason() ?? 'exit'): void => {
    if (done) return
    done = true
    push({ type: 'exit', code: codeForKillReason(getKillReason(), code), reason })
  }

  const finishMissing = (): void => {
    if (done) return
    result = 'missing'
    done = true
    const resume = notify
    notify = null
    resume?.()
  }

  let graceTimer: ReturnType<typeof setTimeout> | null = null

  const tearDownStreams = (): void => {
    child.stdout.destroy()
    child.stderr.destroy()
  }

  const clearGrace = (): void => {
    if (graceTimer) clearTimeout(graceTimer)
    graceTimer = null
  }

  const armGrace = (finalCode: number): void => {
    if (done || graceTimer) return
    graceTimer = setTimeout(() => {
      graceTimer = null
      tearDownStreams()
      finish(finalCode)
    }, EXIT_CLOSE_GRACE_MS)
    graceTimer.unref?.()
  }

  setKillProcessTree(() => {
    killProcessTree(child, platform)
    armGrace(1)
  })

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (data: string) => push({ type: 'stdout', data }))
  child.stderr.on('data', (data: string) => push({ type: 'stderr', data }))
  child.on('error', (error) => {
    if (isMissingExecutable(error)) {
      finishMissing()
      return
    }

    push({ type: 'stderr', data: `${candidate.label}: ${error.message}` })
    finish(1, 'error')
  })
  child.on('exit', (code, exitSignal) => armGrace(code ?? codeForSignal(exitSignal) ?? 1))
  child.on('close', (code, closeSignal) => {
    clearGrace()
    finish(code ?? codeForSignal(closeSignal) ?? 1)
  })

  try {
    while (true) {
      while (queue.length > 0) yield queue.shift() as ShellEvent
      if (done) break
      await new Promise<void>((resolve) => {
        notify = resolve
      })
    }
  } finally {
    clearGrace()
    if (done) setKillProcessTree(null)
  }

  return result
}

export function createShellRunner(options: ShellRunnerOptions = {}): ShellRunner {
  const runnerPlatform = options.platform ?? process.platform
  const env = options.env ?? process.env

  return {
    async *spawn(command, { cwd, timeout, signal }) {
      const candidates = resolveShellCandidates({ platform: runnerPlatform, env })
      const childEnv = safeChildEnv(undefined, env)
      let killReason: KillReason | null = null
      let activeKillProcessTree: (() => void) | null = null

      const kill = (reason: KillReason): void => {
        killReason ??= reason
        activeKillProcessTree?.()
      }

      const timer = timeout ? setTimeout(() => kill('timeout'), timeout) : null
      const onAbort = (): void => kill('abort')
      signal?.addEventListener('abort', onAbort, { once: true })
      if (signal?.aborted) kill('abort')

      try {
        for (const candidate of candidates) {
          if (killReason) break

          const result = yield* runCandidate({
            candidate,
            command,
            cwd,
            childEnv,
            platform: runnerPlatform,
            getKillReason: () => killReason,
            setKillProcessTree: (killProcessTree) => {
              activeKillProcessTree = killProcessTree
            }
          })
          if (result === 'completed') return
        }

        if (killReason) {
          yield { type: 'exit', code: codeForKillReason(killReason, 1), reason: killReason }
          return
        }

        const attempted = candidates.map((candidate) => candidate.label).join(', ')
        yield {
          type: 'stderr',
          data: `No compatible shell was found. Tried: ${attempted}. Install one of these shells or update PATH.`
        }
        yield { type: 'exit', code: 1, reason: 'error' }
      } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        if (activeKillProcessTree) kill('closed')
      }
    }
  }
}
