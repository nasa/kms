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
    test('should throw an error for an invalid conceptId', () => {
      expect(() => getCreateDateQuery('')).toThrow('Invalid conceptId provided')
    })

    test('should throw an error when conceptId is null or undefined', () => {
      expect(() => getCreateDateQuery(null)).toThrow('Invalid conceptId provided')
      expect(() => getCreateDateQuery(undefined)).toThrow('Invalid conceptId provided')
    })

    test('should throw an error for a conceptId containing only unauthorized characters', () => {
      expect(() => getCreateDateQuery('   ')).toThrow('Invalid conceptId provided')
      expect(() => getCreateDateQuery('?!=@#')).toThrow('Invalid conceptId provided')
    })
  })
})
