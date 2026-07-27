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

    test('strips disallowed characters from the concept ID portion instead of rejecting the whole IRI', () => {
      expect(sanitizeConceptIRI('https://example.com/concept/abc123-_.!@#')).toBe('https://example.com/concept/abc123-')
    })
  })

  describe('forbidden characters in the base, rejected via baseRegex', () => {
    test.each(forbiddenChars)('rejects a base containing %s and returns an empty string', (char) => {
      const iri = `https://ex${char}ample.com/concept/123`
      expect(sanitizeConceptIRI(iri)).toBe('')
    })

    test.each(forbiddenChars)('rejects a URN base containing %s and returns an empty string', (char) => {
      const iri = `urn:na${char}sa:gcmd:123`
      expect(sanitizeConceptIRI(iri)).toBe('')
    })
  })

  describe('forbidden characters smuggled into the concept ID portion', () => {
    test.each(forbiddenChars)('strips %s out of the concept ID rather than passing it through', (char) => {
      const iri = `https://example.com/concept/12${char}34`
      const result = sanitizeConceptIRI(iri)
      expect(result).not.toContain(char)
      expect(result).toBe('https://example.com/concept/1234')
    })
  })

  describe('SPARQL injection payloads', () => {
    test('neutralizes an attempted triple-pattern injection via the base', () => {
      const payload = 'https://example.com/concept/> { ?vdp ?p ?o } #/123'
      expect(sanitizeConceptIRI(payload)).toBe('')
    })

    test('strips query-breaking characters smuggled via the concept ID', () => {
      const payload = 'https://example.com/concept/123> { ?vdp ?p ?o } #'
      const result = sanitizeConceptIRI(payload)

      expect(result).not.toMatch(/[<>{}|^`\\"']/)
    })
  })

  describe('malformed input', () => {
    test('returns an empty string for non-string input', () => {
      expect(sanitizeConceptIRI(null)).toBe('')
      expect(sanitizeConceptIRI(undefined)).toBe('')
      expect(sanitizeConceptIRI(123)).toBe('')
      expect(sanitizeConceptIRI({})).toBe('')
    })

    test('returns an empty string when there is no / or : delimiter', () => {
      expect(sanitizeConceptIRI('no-delimiter-at-all')).toBe('')
    })

    test('returns an empty string for an empty input', () => {
      expect(sanitizeConceptIRI('')).toBe('')
    })
  })
})
