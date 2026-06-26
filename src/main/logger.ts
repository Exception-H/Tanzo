import log from 'electron-log/main'
import { app } from 'electron'

type ScopedLogger = ReturnType<typeof log.scope>

const SCOPE_PADDING = 14

const FILE_FORMAT = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{scope}] {text}'
const CONSOLE_FORMAT = '[{h}:{i}:{s}.{ms}] [{level}] [{scope}] {text}'

let initialized = false

export function initializeLogger(): void {
  if (initialized) return
  initialized = true

  log.initialize()

  log.transports.file.level = 'info'
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.file.format = FILE_FORMAT
  log.transports.file.fileName = 'main.log'

  log.transports.console.level = app.isPackaged ? 'warn' : 'debug'
  log.transports.console.format = CONSOLE_FORMAT
  log.transports.console.useStyles = !app.isPackaged

  log.hooks.push((message) => {
    if (message.scope) {
      message.scope = message.scope.padEnd(SCOPE_PADDING)
    }
    return message
  })

  log.errorHandler.startCatching({
    showDialog: false,
    onError({ error }) {
      log.scope('main').error('uncaught', error)
    }
  })
}

export function createLogger(scope: string): ScopedLogger {
  return log.scope(scope)
}

export const logger: ScopedLogger = log.scope('main')

export default logger
