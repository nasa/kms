import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeSchemeIRI } from '../sanitizeSchemeIRI'

describe('sanitizeSchemeIRI', () => {
  describe('valid input', () => {
    test('should allow valid scheme IRIs with letters, hyphens, and underscores in the ID segment', () => {
      const validIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(validIRI)).toBe(validIRI)
    })

    test('should allow alternate base URLs and URN formats with valid scheme IDs', () => {
      const urnIRI = 'urn:example:concept:Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(urnIRI)).toBe(urnIRI)

      const httpIRI = 'http://example.com/concept/Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(httpIRI)).toBe(httpIRI)
    })
  })

  describe('missing input', () => {
    test.each([null, undefined, ''])('returns an empty string for %s', (input) => {
      expect(sanitizeSchemeIRI(input)).toBe('')
    })
  })

  describe('invalid non-empty input, rejected rather than silently rewritten', () => {
    test('should reject (not strip) a scheme ID containing disallowed characters, preserving neither the base nor a mangled ID', () => {
      // Previously this silently stripped to
      // '.../concept_scheme/Earth-Science_' - a different, unintended
      // identifier. Structured values must come back unchanged or not at
      // all, never rewritten into something else.
      const inputIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/Earth-Science_123!'
      expect(sanitizeSchemeIRI(inputIRI)).toBeNull()
    })

    test('should reject invalid base URL or namespace structures', () => {
      const invalidBase = 'invalid-prefix/Earth-Science_Concepts'
      expect(sanitizeSchemeIRI(invalidBase)).toBeNull()
    })

    test('should reject a non-empty string with no / or : delimiter at all', () => {
      expect(sanitizeSchemeIRI('NoDelimiterHere')).toBeNull()
    })

    test('should reject an injection-shaped scheme ID', () => {
      const payload = 'https://example.com/concept/scheme> { ?s ?p ?o } #'
      expect(sanitizeSchemeIRI(payload)).toBeNull()
    })
  })

  describe('invalid non-string input', () => {
    test.each([123, {}, [], false, true, NaN])(
      'returns null for %s (invalid, not missing)',
      (input) => {
        expect(sanitizeSchemeIRI(input)).toBeNull()
      }
    )
  })

  describe('missing vs. invalid are distinguishable', () => {
    test('missing input and invalid input never produce the same non-null signal', () => {
      const missing = sanitizeSchemeIRI(undefined)
      const invalid = sanitizeSchemeIRI('NoDelimiterHere')

      expect(missing).toBe('')
      expect(invalid).toBeNull()
      expect(missing).not.toBe(invalid)
    })
  })
})
