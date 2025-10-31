const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

const getCurrentLogLevel = () => {
  const levelString = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toUpperCase() : undefined

  if (levelString && Object.prototype.hasOwnProperty.call(LOG_LEVELS, levelString)) {
    return LOG_LEVELS[levelString]
  }

  return LOG_LEVELS.INFO // Default to INFO if not set or invalid
}

export const getCallerFunctionName = () => {
  const err = new Error()
  const stack = err.stack.split('\n')
  // Start from index 4 to skip over the logger functions
  for (let i = 4; i < stack.length; i += 1) {
    const line = stack[i]
    const match = line.match(/at\s+(.*)\s+\(/)
    if (match && !match[1].includes('logger.js')) {
      return match[1]
    }
  }

  return 'unknown'
}

const formatMessage = (level, callerName, ...args) => {
  const message = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg)).join(' ')

  return `#${callerName} [${level}] ${message}`
}

export const createLogger = () => {
  const log = (level, ...args) => {
    if (LOG_LEVELS[level] >= getCurrentLogLevel()) {
      const callerName = getCallerFunctionName()
      console.log(formatMessage(level, callerName, ...args))
    }
  }

  return {
    debug: (...args) => log('DEBUG', ...args),
    info: (...args) => log('INFO', ...args),
    warn: (...args) => log('WARN', ...args),
    error: (...args) => log('ERROR', ...args)
  }
}

export const logger = createLogger()
