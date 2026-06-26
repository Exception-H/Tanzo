export interface ShellEvent {
  type: 'stdout' | 'stderr' | 'exit'
  data?: string
  code?: number
  reason?: 'exit' | 'error' | 'timeout' | 'abort' | 'closed'
}

export interface ShellSpawnOptions {
  cwd?: string
  timeout?: number
  signal?: AbortSignal
}

export interface ShellRunner {
  spawn(cmd: string, options: ShellSpawnOptions): AsyncIterable<ShellEvent>
}
