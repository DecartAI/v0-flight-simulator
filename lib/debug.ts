// Debug utility for consistent logging
const DEBUG = process.env.NODE_ENV === 'development'

export const debug = {
  log: (...args: any[]) => {
    if (DEBUG) console.log('[v0]', ...args)
  },
  error: (...args: any[]) => {
    if (DEBUG) console.error('[v0] Error:', ...args)
  },
  warn: (...args: any[]) => {
    if (DEBUG) console.warn('[v0] Warning:', ...args)
  }
}

// Validation helper for common error patterns
export function validateAndSetError(
  condition: any,
  errorMessage: string,
  setError: (msg: string) => void
): boolean {
  if (!condition) {
    debug.error(errorMessage)
    setError(errorMessage)
    return false
  }
  return true
}