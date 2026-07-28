import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeConceptId } from '../sanitizeConceptId'

describe('sanitizeConceptId', () => {
  describe('When successful', () => {
    test('should allow alphanumeric characters and hyphens', () => {
      expect(sanitizeConceptId('concept-123-abc')).toBe('concept-123-abc')
    })

    test('should return an empty string for missing input', () => {
      expect(sanitizeConceptId('')).toBe('')
      expect(sanitizeConceptId(null)).toBe('')
      expect(sanitizeConceptId(undefined)).toBe('')
    })
  })

  describe('When unsuccessful', () => {
    test('should return null for non-string input other than null or undefined', () => {
      expect(sanitizeConceptId('ABC#')).toBe(null)
      expect(sanitizeConceptId({})).toBe(null)
      expect(sanitizeConceptId([])).toBe(null)
    })

    test('should return null for non-empty input containing disallowed characters', () => {
      expect(sanitizeConceptId('concept_123')).toBe(null)
      expect(sanitizeConceptId('concept 123')).toBe(null)
      expect(sanitizeConceptId('concept!@#')).toBe(null)
    })
  })
})
