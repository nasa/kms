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
    test('should throw an error for an empty conceptId', () => {
      expect(() => getModifiedDateQuery('')).toThrow('Invalid conceptId provided')
    })

    test('should throw an error when conceptId is null or undefined', () => {
      expect(() => getModifiedDateQuery(null)).toThrow('Invalid conceptId provided')
      expect(() => getModifiedDateQuery(undefined)).toThrow('Invalid conceptId provided')
    })

    test('should throw an error for a conceptId containing only unauthorized characters', () => {
      expect(() => getModifiedDateQuery('   ')).toThrow('Invalid conceptId provided')
      expect(() => getModifiedDateQuery('?!=@#')).toThrow('Invalid conceptId provided')
    })
  })
})
