import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Writable, Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import type { ShellCandidate } from './resolve'
import { resolveShellCandidates } from './resolve'
import { safeChildEnv } from '../../safe-env'

type ShellProcess = ChildProcessByStdio<Writable, Readable, Readable>
type ShellSessionStatus = 'running' | 'exited' | 'failed' | 'stopped'
type ShellSessionReason = 'exit' | 'error' | 'timeout' | 'abort' | 'closed'

export interface ShellSessionSnapshot {
  sessionId: string
  chatId: string
  command: string
  cwd: string
  status: ShellSessionStatus
  stdout: string
  stderr: string
  exitCode: number | null
  reason?: ShellSessionReason
  startedAt: number
  updatedAt: number
  truncated: boolean
}

export interface ShellSessionListItem {
  sessionId: string
  command: string
  cwd: string
  status: ShellSessionStatus
  exitCode: number | null
  reason?: ShellSessionReason
  startedAt: number
  updatedAt: number
}

export interface ShellSessionService {
  start(input: {
    chatId: string
    command: string
    cwd: string
    timeoutMs?: number
    yieldTimeMs?: number
    signal?: AbortSignal
  }): Promise<ShellSessionSnapshot>
  poll(input: {
    chatId: string
    sessionId: string
    yieldTimeMs?: number
    signal?: AbortSignal
  }): Promise<ShellSessionSnapshot>
  write(input: {
    chatId: string
    sessionId: string
    input: string
    yieldTimeMs?: number
    signal?: AbortSignal
  }): Promise<ShellSessionSnapshot>
  stop(input: {
    chatId: string
    sessionId: string
    signal?: AbortSignal
  }): Promise<{ stopped: true; sessionId: string }>
  list(chatId: string): ShellSessionListItem[]
  close(): Promise<void>
}

interface ShellSessionServiceOptions {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  maxSessions?: number
  maxOutputChars?: number
  defaultYieldTimeMs?: number
  maxYieldTimeMs?: number
}

interface ShellSessionEntry {
  sessionId: string
  chatId: string
  command: string
  cwd: string
  child: ShellProcess | null
  status: ShellSessionStatus
  exitCode: number | null
  reason?: ShellSessionReason
  startedAt: number
  updatedAt: number
  timeout?: ReturnType<typeof setTimeout>
  killTimer?: ReturnType<typeof setTimeout>
  killReason?: ShellSessionReason
  retainedStdout: TextWindow
  retainedStderr: TextWindow
  pendingStdout: TextWindow
  pendingStderr: TextWindow
  waiters: Array<() => void>
}

const DEFAULT_MAX_SESSIONS = 32
const DEFAULT_MAX_OUTPUT_CHARS = 60_000
const DEFAULT_YIELD_TIME_MS = 1_000
const MAX_YIELD_TIME_MS = 30_000
const KILL_CLOSE_GRACE_MS = 2_000

class TextWindow {
  private head = ''
  private tail = ''
  private dropped = 0
  private readonly half: number

  constructor(private readonly max: number) {
    this.half = Math.max(1, Math.floor(max / 2))
  }

  push(chunk: string): void {
    if (!chunk || this.max <= 0) return
    let rest = chunk
    if (this.head.length < this.half) {
      const room = this.half - this.head.length
      this.head += rest.slice(0, room)
      rest = rest.slice(room)
    }
    if (!rest) return
    this.tail += rest
    if (this.tail.length > this.half) {
      this.dropped += this.tail.length - this.half
      this.tail = this.tail.slice(this.tail.length - this.half)
    }
  }

  snapshot(): { text: string; truncated: boolean } {
    if (this.dropped === 0) return { text: this.head + this.tail, truncated: false }
    return {
      text: `${this.head}\n...<${this.dropped} chars truncated>...\n${this.tail}`,
      truncated: true
    }
  }

  drain(): { text: string; truncated: boolean } {
    const result = this.snapshot()
    this.head = ''
    this.tail = ''
    this.dropped = 0
    return result
  }
}

function codeForSignal(signal: NodeJS.Signals | null): number | null {
  if (!signal) return null
  if (signal === 'SIGINT') return 130
  if (signal === 'SIGTERM') return 143
  if (signal === 'SIGKILL') return 137
  return null
}

function codeForReason(reason: ShellSessionReason | undefined, fallback: number | null): number {
  if (reason === 'timeout') return 124
  if (reason === 'abort' || reason === 'closed') return 130
  return fallback ?? 1
}

function isMissingExecutable(error: Error): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function normalizeYieldTimeMs(value: number | undefined, defaultMs: number, maxMs: number): number {
  if (value === undefined) return defaultMs
  return Math.min(maxMs, Math.max(0, value))
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

function destroyChildStreams(child: ShellProcess): void {
  child.stdin.destroy()
  child.stdout.destroy()
  child.stderr.destroy()
}

async function spawnCandidate(
  candidate: ShellCandidate,
  command: string,
  cwd: string,
  platform: NodeJS.Platform,
  childEnv: Record<string, string>
): Promise<ShellProcess> {
  const child = spawn(candidate.file, candidate.args(command), {
    cwd,
    env: childEnv,
    detached: platform !== 'win32',
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  return new Promise((resolve, reject) => {
    child.once('spawn', () => resolve(child))
    child.once('error', (error) => {
      if (isMissingExecutable(error)) reject(error)
      else resolve(child)
    })
  })
}

export function createShellSessionService(
  options: ShellSessionServiceOptions = {}
): ShellSessionService {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS
  const maxOutputChars = options.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS
  const defaultYieldTimeMs = options.defaultYieldTimeMs ?? DEFAULT_YIELD_TIME_MS
  const maxYieldTimeMs = options.maxYieldTimeMs ?? MAX_YIELD_TIME_MS
  const sessions = new Map<string, ShellSessionEntry>()

  function touch(entry: ShellSessionEntry): void {
    entry.updatedAt = Date.now()
  }

  function notify(entry: ShellSessionEntry): void {
    const waiters = entry.waiters.splice(0)
    for (const waiter of waiters) waiter()
  }

  function assertOwnSession(chatId: string, sessionId: string): ShellSessionEntry {
    const entry = sessions.get(sessionId)
    if (!entry) throw new Error(`Unknown shell session ${sessionId}.`)
    if (entry.chatId !== chatId)
      throw new Error(`Shell session ${sessionId} belongs to another chat.`)
    return entry
  }

  function pushOutput(entry: ShellSessionEntry, stream: 'stdout' | 'stderr', chunk: string): void {
    if (!chunk) return
    touch(entry)
    const retained = stream === 'stdout' ? entry.retainedStdout : entry.retainedStderr
    const pending = stream === 'stdout' ? entry.pendingStdout : entry.pendingStderr
    retained.push(chunk)
    pending.push(chunk)
    notify(entry)
  }

  function settle(
    entry: ShellSessionEntry,
    status: Exclude<ShellSessionStatus, 'running'>,
    code: number | null,
    reason: ShellSessionReason
  ): void {
    if (entry.status !== 'running') return
    if (entry.timeout) clearTimeout(entry.timeout)
    if (entry.killTimer) clearTimeout(entry.killTimer)
    entry.status = status
    entry.reason = reason
    entry.exitCode = codeForReason(reason, code)
    entry.child = null
    touch(entry)
    notify(entry)
  }

  function forceKill(entry: ShellSessionEntry, reason: ShellSessionReason): void {
    if (!entry.child || entry.status !== 'running') return
    const child = entry.child
    entry.killReason = reason
    killProcessTree(child, platform)
    entry.killTimer = setTimeout(() => {
      if (entry.status !== 'running') return
      destroyChildStreams(child)
      const status = reason === 'abort' || reason === 'closed' ? 'stopped' : 'exited'
      settle(entry, status, codeForReason(reason, null), reason)
    }, KILL_CLOSE_GRACE_MS)
    entry.killTimer.unref?.()
  }

  async function waitForOutput(
    entry: ShellSessionEntry,
    yieldTimeMs?: number,
    signal?: AbortSignal
  ): Promise<void> {
    const waitMs = normalizeYieldTimeMs(yieldTimeMs, defaultYieldTimeMs, maxYieldTimeMs)
    if (signal?.aborted || waitMs <= 0 || entry.status !== 'running') return
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = (): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', finish)
        resolve()
      }
      const timer = setTimeout(finish, waitMs)
      signal?.addEventListener('abort', finish, { once: true })
      entry.waiters.push(finish)
    })
  }

  function drainSnapshot(entry: ShellSessionEntry): ShellSessionSnapshot {
    const stdout = entry.pendingStdout.drain()
    const stderr = entry.pendingStderr.drain()
    return {
      sessionId: entry.sessionId,
      chatId: entry.chatId,
      command: entry.command,
      cwd: entry.cwd,
      status: entry.status,
      stdout: stdout.text,
      stderr: stderr.text,
      exitCode: entry.exitCode,
      ...(entry.reason ? { reason: entry.reason } : {}),
      startedAt: entry.startedAt,
      updatedAt: entry.updatedAt,
      truncated: stdout.truncated || stderr.truncated
    }
  }

  function listItem(entry: ShellSessionEntry): ShellSessionListItem {
    return {
      sessionId: entry.sessionId,
      command: entry.command,
      cwd: entry.cwd,
      status: entry.status,
      exitCode: entry.exitCode,
      ...(entry.reason ? { reason: entry.reason } : {}),
      startedAt: entry.startedAt,
      updatedAt: entry.updatedAt
    }
  }

  function pruneIfNeeded(): void {
    if (sessions.size < maxSessions) return
    const entries = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)
    const removable = entries.find((entry) => entry.status !== 'running') ?? entries[0]
    if (!removable) return
    if (removable.child) {
      removable.killReason = 'closed'
      killProcessTree(removable.child, platform)
    }
    sessions.delete(removable.sessionId)
  }

  async function spawnShell(command: string, cwd: string): Promise<ShellProcess> {
    const candidates = resolveShellCandidates({ platform, env })
    const childEnv = safeChildEnv(undefined, env)
    let lastError: unknown
    for (const candidate of candidates) {
      try {
        return await spawnCandidate(candidate, command, cwd, platform, childEnv)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('No compatible shell was found. Install a shell or update PATH.')
  }

  return {
    async start({ chatId, command, cwd, timeoutMs, yieldTimeMs, signal }) {
      pruneIfNeeded()
      const sessionId = randomUUID()
      const now = Date.now()
      const entry: ShellSessionEntry = {
        sessionId,
        chatId,
        command,
        cwd,
        child: null,
        status: 'running',
        exitCode: null,
        startedAt: now,
        updatedAt: now,
        retainedStdout: new TextWindow(maxOutputChars),
        retainedStderr: new TextWindow(maxOutputChars),
        pendingStdout: new TextWindow(maxOutputChars),
        pendingStderr: new TextWindow(maxOutputChars),
        waiters: []
      }
      sessions.set(sessionId, entry)
      const abortStartedSession = (): void => {
        forceKill(entry, 'abort')
      }
      signal?.addEventListener('abort', abortStartedSession, { once: true })

      try {
        const child = await spawnShell(command, cwd)
        entry.child = child
        child.stdin.on('error', () => undefined)
        child.stdout.on('data', (data: string) => pushOutput(entry, 'stdout', data))
        child.stderr.on('data', (data: string) => pushOutput(entry, 'stderr', data))
        child.on('error', (error) => {
          pushOutput(entry, 'stderr', `${error.message}\n`)
          settle(entry, 'failed', 1, 'error')
        })
        child.on('close', (code, signal) => {
          const reason = entry.killReason ?? 'exit'
          const status = reason === 'abort' || reason === 'closed' ? 'stopped' : 'exited'
          settle(entry, status, code ?? codeForSignal(signal), reason)
        })
        if (signal?.aborted) {
          entry.killReason = 'abort'
          if (entry.child) killProcessTree(entry.child, platform)
          settle(entry, 'stopped', 130, 'abort')
        } else if (timeoutMs) {
          entry.timeout = setTimeout(() => {
            forceKill(entry, 'timeout')
          }, timeoutMs)
        }
      } catch (error) {
        pushOutput(entry, 'stderr', error instanceof Error ? `${error.message}\n` : String(error))
        settle(entry, 'failed', 1, 'error')
      }

      await waitForOutput(entry, yieldTimeMs, signal)
      signal?.removeEventListener('abort', abortStartedSession)
      return drainSnapshot(entry)
    },

    async poll({ chatId, sessionId, yieldTimeMs, signal }) {
      const entry = assertOwnSession(chatId, sessionId)
      touch(entry)
      await waitForOutput(entry, yieldTimeMs, signal)
      return drainSnapshot(entry)
    },

    async write({ chatId, sessionId, input, yieldTimeMs, signal }) {
      const entry = assertOwnSession(chatId, sessionId)
      if (entry.status !== 'running' || !entry.child) {
        throw new Error(`Shell session ${sessionId} is not running.`)
      }
      const stdin = entry.child.stdin
      if (!stdin.writable || stdin.destroyed) {
        throw new Error(`Shell session ${sessionId} cannot accept input.`)
      }
      try {
        stdin.write(input)
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
      }
      touch(entry)
      await waitForOutput(entry, yieldTimeMs, signal)
      return drainSnapshot(entry)
    },

    async stop({ chatId, sessionId, signal }) {
      const entry = assertOwnSession(chatId, sessionId)
      if (entry.child && entry.status === 'running') {
        const child = entry.child
        entry.killReason = 'abort'
        killProcessTree(child, platform)
        await waitForOutput(entry, 1_000, signal)
        if (entry.status === 'running') destroyChildStreams(child)
      }
      if (entry.status === 'running') settle(entry, 'stopped', 130, 'abort')
      return { stopped: true, sessionId }
    },

    list(chatId) {
      return [...sessions.values()]
        .filter((entry) => entry.chatId === chatId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(listItem)
    },

    async close() {
      const entries = [...sessions.values()]
      sessions.clear()
      for (const entry of entries) {
        if (!entry.child || entry.status !== 'running') continue
        const child = entry.child
        entry.killReason = 'closed'
        killProcessTree(child, platform)
        destroyChildStreams(child)
        settle(entry, 'stopped', 130, 'closed')
      }
    }
  }
}
