import {
  describe,
  expect,
  test
} from 'vitest'

import { sanitizeScheme } from '../sanitizeScheme'

describe('sanitizeScheme', () => {
  describe('missing input', () => {
    test.each([null, undefined, ''])('returns an empty string for %s', (input) => {
      expect(sanitizeScheme(input)).toBe('')
    })

    test('returns an empty string when called with no argument', () => {
      expect(sanitizeScheme()).toBe('')
    })
  })

  describe('valid input', () => {
    test('returns letters-only input unchanged', () => {
      expect(sanitizeScheme('EarthScience')).toBe('EarthScience')
    })

    test('returns input with hyphens and underscores unchanged', () => {
      expect(sanitizeScheme('Earth-Science_Concept')).toBe('Earth-Science_Concept')
    })

    test('returns a single valid character unchanged', () => {
      expect(sanitizeScheme('a')).toBe('a')
    })
  })

  describe('invalid non-empty string input', () => {
    test.each([
      'abc123',
      'Earth Science',
      'abc!@#',
      ' ',
      ' abc ',
      'a> { ?s ?p ?o } #'
    ])('returns null for %s rather than a silently-stripped string', (input) => {
      expect(sanitizeScheme(input)).toBeNull()
    })
  })

  describe('invalid non-string input', () => {
    test.each([0, 123, false, true, NaN, [], {}])(
      'returns null for %s (invalid, not missing)',
      (input) => {
        expect(sanitizeScheme(input)).toBeNull()
      }
    )
  })

  describe('missing vs. invalid are distinguishable', () => {
    test('missing input and invalid input never produce the same non-null signal', () => {
      const missing = sanitizeScheme(undefined)
      const invalid = sanitizeScheme('abc123')

      expect(missing).toBe('')
      expect(invalid).toBeNull()
      expect(missing).not.toBe(invalid)
    })

    test('a falsy-but-invalid value (0) is still flagged as invalid, not missing', () => {
      // Regression guard: a caller check of `if (scheme && result === null)`
      // would silently miss this case since 0 is falsy. The contract must
      // hold on the return value alone, without relying on truthiness of
      // the original input.
      expect(sanitizeScheme(0)).toBeNull()
    })
  })
})
