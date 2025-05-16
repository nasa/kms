import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { createRelationshipQuery } from '../getCreateRelationshipQuery'

describe('createRelationshipQuery', () => {
  describe('When called with valid parameters', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop', 'qrst-uvwx-yz12-3456'],
      relationship: 'skos:broader'
    }

    const result = createRelationshipQuery(params)

    test('should return a string', () => {
      expect(typeof result).toBe('string')
    })

    test('should include the prefixes', () => {
      expect(result).toContain(prefixes)
    })

    test('should include the INSERT DATA clause', () => {
      expect(result).toContain('INSERT DATA {')
    })

    test('should generate correct triples for each target UUID', () => {
      params.targetUuids.forEach((uuid) => {
        const expectedTriple = `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${params.relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${params.sourceUuid}>`
        expect(result).toContain(expectedTriple)
      })
    })
  })

  describe('When called with a single target UUID', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop'],
      relationship: 'skos:broader'
    }

    test('should generate a query with one triple', () => {
      const result = createRelationshipQuery(params)
      const tripleCount = (result.match(/https:\/\/gcmd\.earthdata\.nasa\.gov\/kms\/concept/g) || []).length
      expect(tripleCount).toBe(2) // Two URIs in one triple
    })
  })

  describe('When called with multiple target UUIDs', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop', 'qrst-uvwx-yz12-3456', '7890-1234-5678-9012'],
      relationship: 'skos:broader'
    }

    test('should generate a query with multiple triples', () => {
      const result = createRelationshipQuery(params)
      const tripleCount = (result.match(/https:\/\/gcmd\.earthdata\.nasa\.gov\/kms\/concept/g) || []).length
      expect(tripleCount).toBe(6) // Two URIs per triple, three triples
    })
  })

  describe('When called with a different relationship', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop'],
      relationship: 'custom:relation'
    }

    test('should use the provided relationship in the query', () => {
      const result = createRelationshipQuery(params)
      expect(result).toContain('custom:relation')
    })
  })
})
