/**
 * Structured API logger for Maiat.
 * Consistent format: [Maiat] METHOD /path → STATUS (durationMs)
 */

type LogLevel = 'info' | 'warn' | 'error'

function ts(): string {
  return new Date().toISOString()
}

function fmt(level: LogLevel, tag: string, msg: string, meta?: Record<string, unknown>): string {
  const prefix = `[Maiat:${tag}]`
  const metaStr = meta ? ' ' + JSON.stringify(meta) : ''
  return `${ts()} ${level.toUpperCase()} ${prefix} ${msg}${metaStr}`
}

export const apiLog = {
  /** Log an incoming API request */
  request(method: string, path: string, meta?: Record<string, unknown>) {
    console.log(fmt('info', 'API', `${method} ${path}`, meta))
  },

  /** Log a successful API response */
  response(method: string, path: string, status: number, durationMs: number) {
    const level: LogLevel = status >= 400 ? 'warn' : 'info'
    console.log(fmt(level, 'API', `${method} ${path} → ${status} (${durationMs}ms)`))
  },

  /** Log an API error */
  error(tag: string, error: unknown, meta?: Record<string, unknown>) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error(fmt('error', tag, message, { ...meta, ...(stack ? { stack } : {}) }))
  },

  /** General info log */
  info(tag: string, msg: string, meta?: Record<string, unknown>) {
    console.log(fmt('info', tag, msg, meta))
  },

  /** General warning log */
  warn(tag: string, msg: string, meta?: Record<string, unknown>) {
    console.warn(fmt('warn', tag, msg, meta))
  },
}
