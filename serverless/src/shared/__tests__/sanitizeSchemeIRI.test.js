import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeSchemeIRI } from '../sanitizeSchemeIRI'

describe('sanitizeSchemeIRI', () => {
  describe('When successful', () => {
    test('should allow valid scheme IRIs with letters and spaces in the ID segment', () => {
      const validIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/Earth Science Concepts'
      expect(sanitizeSchemeIRI(validIRI)).toBe(validIRI)
    })

    test('should sanitize invalid characters in the scheme ID segment while preserving the base URL', () => {
      const inputIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/Earth-Science_123!'
      const expectedIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/EarthScience'
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
  })
})
