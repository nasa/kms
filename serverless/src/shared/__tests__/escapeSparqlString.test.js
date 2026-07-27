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

    test('should strip null characters', () => {
      expect(escapeSparqlString('Null\0character')).toBe('Nullcharacter')
    })

    test('should handle multiple special characters', () => {
      expect(escapeSparqlString('Test "quote" and \'apostrophe\' and \\ backslash and \0 null')).toBe(
        'Test \\"quote\\" and \\\'apostrophe\\\' and \\\\ backslash and  null'
      )
    })

    test('should return an empty string for an empty input', () => {
      expect(escapeSparqlString('')).toBe('')
    })

    test('should handle newlines, tabs, and carriage returns', () => {
      expect(escapeSparqlString('Line1\nLine2\r\tTab')).toBe('Line1\\nLine2\\r\\tTab')
    })

    test('should strip unauthorized control characters', () => {
      // \x01 is in the stripped range [\x00-\x07\x0B\x0E-\x1F]
      expect(escapeSparqlString('Hello\x01World')).toBe('HelloWorld')
    })

    test('should decode and escape single URL-encoded inputs', () => {
      expect(escapeSparqlString('Hello%20%22world%22')).toBe('Hello \\"world\\"')
    })

    test('should decode and escape multi-layer (double) URL-encoded inputs', () => {
      // Example using generic, safe test vectors instead of live parameters
      const payload = 'sample%2522test%2522'
      const expected = 'sample\\"test\\"'
      expect(escapeSparqlString(payload)).toBe(expected)
    })

    test('should handle malformed percent-encodings gracefully without throwing', () => {
      expect(escapeSparqlString('Malformed%ZZinput')).toBe('Malformed%ZZinput')
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
