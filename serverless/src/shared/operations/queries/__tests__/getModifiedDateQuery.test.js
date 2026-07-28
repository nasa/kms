import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getModifiedDateQuery } from '../getModifiedDateQuery'

describe('getModifiedDateQuery', () => {
  describe('When successful', () => {
    test('should generate a valid SPARQL query for a valid conceptId', () => {
      const conceptId = '12345678-abcd-1234-abcd-123456789abc'
      const query = getModifiedDateQuery(conceptId)

      expect(query).toContain(prefixes)
      expect(query).toContain('SELECT ?modified')
      expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:modified ?modified .`)
    })
  })

  describe('When unsuccessful', () => {
    test('should throw an error for non-string conceptId other than null or undefined', () => {
      expect(() => getModifiedDateQuery(123)).toThrow('Invalid conceptId provided')
      expect(() => getModifiedDateQuery({})).toThrow('Invalid conceptId provided')
    })

    test('should throw an error for a conceptId containing disallowed characters', () => {
      expect(() => getModifiedDateQuery('?!=@#')).toThrow('Invalid conceptId provided')
    })
  })

  describe('When missing or empty', () => {
    test('should handle missing or empty conceptId gracefully without throwing', () => {
      expect(() => getModifiedDateQuery('')).not.toThrow()
      expect(() => getModifiedDateQuery(null)).not.toThrow()
      expect(() => getModifiedDateQuery(undefined)).not.toThrow()
    })
  })
})
