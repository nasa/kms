import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeScheme } from '../sanitizeScheme'

describe('sanitizeScheme', () => {
  describe('When successful', () => {
    test('should allow letters, hyphens, and underscores', () => {
      expect(sanitizeScheme('Earth-Science_Concepts')).toBe('Earth-Science_Concepts')
    })

    test('should remove numbers and special characters while preserving letters, hyphens, and underscores', () => {
      expect(sanitizeScheme('Science-123_abc!@#')).toBe('Science-_abc')
    })

    test('should return an empty string for an empty input', () => {
      expect(sanitizeScheme('')).toBe('')
    })
  })

  describe('When unsuccessful', () => {
    test('should return an empty string for non-string input', () => {
      expect(sanitizeScheme(null)).toBe('')
      expect(sanitizeScheme(undefined)).toBe('')
      expect(sanitizeScheme(123)).toBe('')
      expect(sanitizeScheme({})).toBe('')
      expect(sanitizeScheme([])).toBe('')
    })
  })
})
