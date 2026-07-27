import {
  describe,
  expect,
  test
} from 'vitest'

import {
  baseRegex,
  conceptIdRegex,
  schemeRegex
} from '../regex'

describe('Regex Patterns', () => {
  describe('conceptIdRegex', () => {
    test('should match invalid characters for concept IDs', () => {
      const input = 'abc123-_.!@#'
      const result = input.replace(conceptIdRegex, '')
      expect(result).toBe('abc123-')
    })
  })

  describe('schemeRegex', () => {
    test('should match invalid characters for scheme IDs', () => {
      const input = 'Earth Science-Concept_123!'
      const result = input.replace(schemeRegex, '')
      expect(result).toBe('EarthScience-Concept_')
    })
  })

  describe('baseRegex', () => {
    test('should validate correct HTTP/HTTPS base URLs', () => {
      expect(baseRegex.test('https://example.com/concept/')).toBe(true)
      expect(baseRegex.test('http://gcmd.earthdata.nasa.gov/kms/concept/')).toBe(true)
    })

    test('should validate correct URN base namespaces', () => {
      expect(baseRegex.test('urn:example:concept:')).toBe(true)
      expect(baseRegex.test('urn:nasa:gcmd:')).toBe(true)
    })

    test('should reject invalid base URLs or namespaces', () => {
      expect(baseRegex.test('ftp://example.com/concept/')).toBe(false)
      expect(baseRegex.test('just-a-string')).toBe(false)
      expect(baseRegex.test('https://example.com')).toBe(false)
    })
  })
})
