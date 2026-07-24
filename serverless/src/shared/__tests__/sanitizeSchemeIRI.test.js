import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeSchemeIRI } from '../sanitizeSchemeIRI'

describe('sanitizeSchemeIRI', () => {
  describe('When successful', () => {
    test('should allow valid scheme IRIs with letters, spaces, hyphens, and underscores in the ID segment', () => {
      const validIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(validIRI)).toBe(validIRI)
    })

    test('should allow alternate base URLs and URN formats with valid scheme IDs', () => {
      const urnIRI = 'urn:example:concept:Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(urnIRI)).toBe(urnIRI)

      const httpIRI = 'http://example.com/concept/Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(httpIRI)).toBe(httpIRI)
    })

    test('should sanitize invalid characters in the scheme ID segment while preserving the base URL/namespace', () => {
      const inputIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/Earth-Science_123!'
      const expectedIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/Earth-Science_'
      expect(sanitizeSchemeIRI(inputIRI)).toBe(expectedIRI)
    })

    test('should return an empty string for an empty input', () => {
      expect(sanitizeSchemeIRI('')).toBe('')
    })
  })

  describe('When unsuccessful', () => {
    test('should return an empty string for non-string input', () => {
      expect(sanitizeSchemeIRI(null)).toBe('')
      expect(sanitizeSchemeIRI(undefined)).toBe('')
      expect(sanitizeSchemeIRI(123)).toBe('')
      expect(sanitizeSchemeIRI({})).toBe('')
      expect(sanitizeSchemeIRI([])).toBe('')
    })

    test('should return an empty string for invalid base URL or namespace structures', () => {
      const invalidBase = 'invalid-prefix/Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(invalidBase)).toBe('')
    })
  })
})
