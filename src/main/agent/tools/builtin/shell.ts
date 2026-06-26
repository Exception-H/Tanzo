import { tool, zodSchema } from 'ai'
import type { TanzoTools } from '@shared/agent-message'
import type { ToolDeps } from '../types'
import { HeadTailBuffer } from '../text-output'
import { shellInputSchema, SHELL_MAX_TIMEOUT_MS, SHELL_MIN_TIMEOUT_MS } from '../tool-schemas'

const MAX_OUTPUT = 30_000
const DEFAULT_TIMEOUT_MS = 120_000
const ANSI_ESCAPE = String.fromCharCode(0x1b)
const ANSI_BELL = String.fromCharCode(0x07)
const ANSI_OSC = new RegExp(
  String.raw`${ANSI_ESCAPE}\][^${ANSI_BELL}]*(?:${ANSI_BELL}|${ANSI_ESCAPE}\\)`,
  'g'
)
const ANSI_CSI = new RegExp(String.raw`${ANSI_ESCAPE}\[[0-?]*[ -/]*[@-~]`, 'g')

function normalizeTimeoutMs(timeoutMs?: number): number {
  const raw = timeoutMs
  if (raw === undefined) return DEFAULT_TIMEOUT_MS

  return Math.min(SHELL_MAX_TIMEOUT_MS, Math.max(SHELL_MIN_TIMEOUT_MS, raw))
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_OSC, '').replace(ANSI_CSI, '')
}

export const shellTool = (deps: ToolDeps) =>
  tool<TanzoTools['shell']['input'], TanzoTools['shell']['output'], Record<string, unknown>>({
    description:
      'Run a shell command with the platform-compatible shell runner: the user login shell/bash/sh on ' +
      'macOS/Linux, and PowerShell with cmd.exe fallback on Windows. The default working directory is the ' +
      'workspace root; absolute workdirs outside the workspace require dangerous mode. Use for builds, tests, ' +
      'git, package managers, and commands that dedicated file/search tools cannot express. Prefer grep/glob/' +
      'fileRead for code inspection. Output streams live and long output is truncated head+tail.',
    inputSchema: zodSchema(shellInputSchema),
    metadata: {
      tanzo: { kind: 'exec', component: 'ShellCard', fingerprintFields: ['command'] }
    },
    async *execute(
      { command, workdir, timeoutMs },
      { abortSignal }
    ): AsyncGenerator<TanzoTools['shell']['output']> {
      const shellCwd = workdir ? await deps.fs.resolveWorkspace(workdir, abortSignal) : deps.fs.root
      const resolvedTimeoutMs = normalizeTimeoutMs(timeoutMs)
      const proc = deps.shell.spawn(command, {
        cwd: shellCwd,
        timeout: resolvedTimeoutMs,
        signal: abortSignal
      })
      const out = new HeadTailBuffer(MAX_OUTPUT)
      const err = new HeadTailBuffer(MAX_OUTPUT)
      let code = 0
      let reason: TanzoTools['shell']['output']['reason'] | undefined
      for await (const ev of proc) {
        if (ev.type === 'stdout') out.push(stripAnsi(ev.data ?? ''))
        if (ev.type === 'stderr') err.push(stripAnsi(ev.data ?? ''))
        if (ev.type === 'exit') {
          code = ev.code ?? 1
          reason = ev.reason
        }
        yield {
          stdout: out.toString(),
          stderr: err.toString(),
          code,
          ...(reason ? { reason } : {})
        }
      }
    }
  })
