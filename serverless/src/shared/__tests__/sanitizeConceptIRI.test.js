import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeConceptIRI } from '../sanitizeConceptIRI'

describe('sanitizeConceptIRI', () => {
  describe('When successful', () => {
    test('should allow valid concept IRIs with alphanumeric characters and hyphens in the ID segment', () => {
      const validIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/concept-123-abc'
      expect(sanitizeConceptIRI(validIRI)).toBe(validIRI)
    })

    test('should sanitize invalid characters and underscores in the concept ID segment while preserving the base URL', () => {
      const inputIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/concept_123-abc!@#'
      const expectedIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/concept123-abc'
      expect(sanitizeConceptIRI(inputIRI)).toBe(expectedIRI)
    })

    test('should return an empty string for an empty input', () => {
      expect(sanitizeConceptIRI('')).toBe('')
    })
  })

  describe('When unsuccessful', () => {
    test('should return an empty string for non-string input', () => {
      expect(sanitizeConceptIRI(null)).toBe('')
      expect(sanitizeConceptIRI(undefined)).toBe('')
      expect(sanitizeConceptIRI(123)).toBe('')
      expect(sanitizeConceptIRI({})).toBe('')
      expect(sanitizeConceptIRI([])).toBe('')
    })
  })
})
