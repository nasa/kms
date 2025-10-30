import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { createLogger, getCallerFunctionName } from '../logger'

describe('logger', () => {
  let logger
  let consoleLogMock

  beforeEach(() => {
    consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.LOG_LEVEL = 'info'
    logger = createLogger()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.LOG_LEVEL
  })

  describe('When logging at different levels', () => {
    test('should not log debug messages when log level is set to INFO', () => {
      logger.debug('Debug message')
      expect(console.log).not.toHaveBeenCalled()
    })

    test('should log info messages when log level is set to INFO', () => {
      logger.info('Info message')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] Info message'))
    })

    test('should log warn messages when log level is set to INFO', () => {
      logger.warn('Warn message')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[WARN] Warn message'))
    })

    test('should log error messages when log level is set to INFO', () => {
      logger.error('Error message')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Error message'))
    })
  })

  describe('When logging objects', () => {
    test('should stringify objects in the log message', () => {
      const obj = { key: 'value' }
      logger.info('Object:', obj)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] Object: {\n  "key": "value"\n}'))
    })
  })

  describe('When getting caller function name', () => {
    test('should include the caller function name in the log message', () => {
      function testFunction() {
        logger.info('Test message')
      }

      testFunction()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('testFunction [INFO] Test message'))
    })
  })

  describe('When changing log level', () => {
    test('should respect the LOG_LEVEL environment variable', () => {
      consoleLogMock.mockReset()
      consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {})

      process.env.LOG_LEVEL = 'debug' // Set to DEBUG level
      const newLogger = createLogger()
      newLogger.debug('Debug message')

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Debug message'))
    })
  })

  describe('When unable to determine caller function name', () => {
    test('should return "unknown" as the caller function name', () => {
      const mockError = {
        stack: 'Error\n    at logger.js:1:1'
      }

      vi.spyOn(global, 'Error').mockImplementation(() => mockError)

      const result = getCallerFunctionName()

      expect(result).toBe('unknown')

      vi.restoreAllMocks()
    })
  })
})
