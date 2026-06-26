import log from 'electron-log/renderer'

type ScopedLogger = ReturnType<typeof log.scope>

export function createLogger(scope: string): ScopedLogger {
  return log.scope(scope)
}

export const logger: ScopedLogger = log.scope('renderer')

export default logger
