import {
  describe,
  expect,
  test
} from 'vitest'

import { escapeSparqlString } from '../escapeSparqlString'

describe('escapeSparqlString', () => {
  describe('When successful', () => {
    test('should escape double quotes', () => {
      expect(escapeSparqlString('Hello "world"')).toBe('Hello \\"world\\"')
    })

    test('should escape single quotes', () => {
      expect(escapeSparqlString("It's a test")).toBe("It\\'s a test")
    })

    test('should escape backslashes', () => {
      expect(escapeSparqlString('C:\\Program Files')).toBe('C:\\\\Program Files')
    })

    test('should replace null characters with \\0', () => {
      expect(escapeSparqlString('Null\0character')).toBe('Null\\0character')
    })

    test('should handle multiple special characters', () => {
      expect(escapeSparqlString('Test "quote" and \'apostrophe\' and \\ backslash and \0 null')).toBe(
        'Test \\"quote\\" and \\\'apostrophe\\\' and \\\\ backslash and \\0 null'
      )
    })

    test('should return an empty string for an empty input', () => {
      expect(escapeSparqlString('')).toBe('')
    })
  })

  describe('When unsuccessful', () => {
    test('should return an empty string for non-string input', () => {
      expect(escapeSparqlString(null)).toBe('')
      expect(escapeSparqlString(undefined)).toBe('')
      expect(escapeSparqlString(123)).toBe('')
      expect(escapeSparqlString({})).toBe('')
      expect(escapeSparqlString([])).toBe('')
    })
  })
})
