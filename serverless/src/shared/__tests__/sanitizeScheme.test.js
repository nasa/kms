import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeScheme } from '../sanitizeScheme'

describe('sanitizeScheme', () => {
  describe('When successful', () => {
    test('should allow letters and spaces', () => {
      expect(sanitizeScheme('Earth Science Concepts')).toBe('Earth Science Concepts')
    })

    test('should remove numbers, hyphens, underscores, and special characters', () => {
      expect(sanitizeScheme('Science-123_abc!@#')).toBe('Scienceabc')
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
