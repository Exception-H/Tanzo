export interface SqlRunResult {
  changes: number
  lastInsertRowid?: unknown
}

export interface SqlStatement {
  run(params?: Record<string, unknown> | unknown[]): SqlRunResult
  get(params?: Record<string, unknown> | unknown[]): unknown
  all(params?: Record<string, unknown> | unknown[]): unknown[]
}

export interface SqlDatabase {
  exec(sql: string): void
  prepare(sql: string): SqlStatement
  transaction<T>(fn: () => T): T
  pragma(directive: string): void
  close(): void
}

export interface Migration {
  version: number
  name: string
  up(db: SqlDatabase): void
}

export interface ModuleMigrations {
  moduleName: string
  files: readonly Migration[]
}
