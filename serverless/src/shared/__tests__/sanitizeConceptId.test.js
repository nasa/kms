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

    test('should remove underscores, special characters, and spaces', () => {
      expect(sanitizeConceptId('concept_123@abc! id#')).toBe('concept123abcid')
    })

    test('should return an empty string for an empty input', () => {
      expect(sanitizeConceptId('')).toBe('')
    })
  })

  describe('When unsuccessful', () => {
    test('should return an empty string for non-string input', () => {
      expect(sanitizeConceptId(null)).toBe('')
      expect(sanitizeConceptId(undefined)).toBe('')
      expect(sanitizeConceptId(123)).toBe('')
      expect(sanitizeConceptId({})).toBe('')
      expect(sanitizeConceptId([])).toBe('')
    })
  })
})
