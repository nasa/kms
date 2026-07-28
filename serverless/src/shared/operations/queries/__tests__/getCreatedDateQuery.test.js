import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getCreateDateQuery } from '../getCreatedDateQuery'

describe('getCreateDateQuery', () => {
  describe('When successful', () => {
    test('should generate a valid SPARQL query for a valid conceptId', () => {
      const conceptId = '12345678-abcd-1234-abcd-123456789abc'
      const query = getCreateDateQuery(conceptId)

      expect(query).toContain(prefixes)
      expect(query).toContain('SELECT ?created')
      expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:created ?created .`)
    })
  })

  describe('When unsuccessful', () => {
    test('should throw an error for non-string conceptId other than null or undefined', () => {
      expect(() => getCreateDateQuery('ABC#')).toThrow('Invalid conceptId provided')
      expect(() => getCreateDateQuery({})).toThrow('Invalid conceptId provided')
    })

    test('should throw an error for a conceptId containing disallowed characters', () => {
      expect(() => getCreateDateQuery('?!=@#')).toThrow('Invalid conceptId provided')
    })
  })

  describe('When missing or empty', () => {
    test('should handle missing or empty conceptId gracefully without throwing', () => {
      expect(() => getCreateDateQuery('')).not.toThrow()
      expect(() => getCreateDateQuery(null)).not.toThrow()
      expect(() => getCreateDateQuery(undefined)).not.toThrow()
    })
  })
})
