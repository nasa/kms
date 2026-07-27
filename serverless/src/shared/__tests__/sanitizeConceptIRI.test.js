import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeConceptIRI } from '../sanitizeConceptIRI'

// Characters that must never survive into a SPARQL-interpolated IRI base.
const forbiddenChars = ['<', '>', '"', "'", '{', '}', '|', '^', '`', '\\']

describe('sanitizeConceptIRI', () => {
  describe('valid IRIs', () => {
    test('accepts a valid HTTPS concept IRI unchanged', () => {
      expect(sanitizeConceptIRI('https://example.com/concept/123')).toBe('https://example.com/concept/123')
    })

    test('accepts a valid HTTP concept IRI unchanged', () => {
      const iri = 'http://gcmd.earthdata.nasa.gov/kms/concept/abc-123'
      expect(sanitizeConceptIRI(iri)).toBe(iri)
    })

    test('accepts a valid URN concept IRI unchanged', () => {
      expect(sanitizeConceptIRI('urn:nasa:gcmd:123')).toBe('urn:nasa:gcmd:123')
    })
  })

  describe('forbidden characters in the base, rejected via baseRegex', () => {
    test.each(forbiddenChars)('rejects a base containing %s and returns null', (char) => {
      const iri = `https://ex${char}ample.com/concept/123`
      expect(sanitizeConceptIRI(iri)).toBe(null)
    })

    test.each(forbiddenChars)('rejects a URN base containing %s and returns null', (char) => {
      const iri = `urn:na${char}sa:gcmd:123`
      expect(sanitizeConceptIRI(iri)).toBe(null)
    })
  })

  describe('invalid concept ID segment, rejected instead of rewritten', () => {
    test('rejects the entire IRI and returns null if the concept ID contains disallowed characters', () => {
      expect(sanitizeConceptIRI('https://example.com/concept/abc123-_.!@#')).toBe(null)
    })

    test.each(forbiddenChars)('rejects an IRI when %s is smuggled into the concept ID portion', (char) => {
      const iri = `https://example.com/concept/12${char}34`
      expect(sanitizeConceptIRI(iri)).toBe(null)
    })
  })

  describe('SPARQL injection payloads', () => {
    test('neutralizes an attempted triple-pattern injection via the base by returning null', () => {
      const payload = 'https://example.com/concept/> { ?vdp ?p ?o } #/123'
      expect(sanitizeConceptIRI(payload)).toBe(null)
    })

    test('rejects query-breaking characters smuggled via the concept ID by returning null', () => {
      const payload = 'https://example.com/concept/123> { ?vdp ?p ?o } #'
      expect(sanitizeConceptIRI(payload)).toBe(null)
    })
  })

  describe('missing input handling', () => {
    test('returns an empty string for missing input (null, undefined, or empty string)', () => {
      expect(sanitizeConceptIRI(null)).toBe('')
      expect(sanitizeConceptIRI(undefined)).toBe('')
      expect(sanitizeConceptIRI('')).toBe('')
    })
  })

  describe('malformed input returning null', () => {
    test('returns null for non-string input other than null or undefined', () => {
      expect(sanitizeConceptIRI(123)).toBe(null)
      expect(sanitizeConceptIRI({})).toBe(null)
    })

    test('returns null when there is no / or : delimiter', () => {
      expect(sanitizeConceptIRI('no-delimiter-at-all')).toBe(null)
    })
  })
})
