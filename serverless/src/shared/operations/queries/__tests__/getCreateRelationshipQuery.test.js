import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getCreateRelationshipQuery } from '../getCreateRelationshipQuery'

describe('createRelationshipQuery', () => {
  describe('When called with valid parameters', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop', 'qrst-uvwx-yz12-3456'],
      relationship: 'skos:broader'
    }

    const result = getCreateRelationshipQuery(params)

    test('should return a string', () => {
      expect(typeof result).toBe('string')
    })

    test('should include the prefixes', () => {
      expect(result).toContain(prefixes)
    })

    test('should include the INSERT clause', () => {
      expect(result).toContain('INSERT {')
    })

    test('should include the WHERE clause', () => {
      expect(result).toContain('WHERE {')
    })

    test('should generate correct triples for each target UUID', () => {
      params.targetUuids.forEach((uuid) => {
        const expectedTriple = `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${params.relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${params.sourceUuid}>`
        expect(result).toContain(expectedTriple)
      })
    })

    test('should include existence checks for source and target concepts', () => {
      expect(result).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${params.sourceUuid}> a ?sourceType .`)
      params.targetUuids.forEach((uuid, index) => {
        expect(result).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> a ?targetType${index + 1} .`)
      })
    })

    test('should include FILTER NOT EXISTS clause', () => {
      expect(result).toContain('FILTER NOT EXISTS {')
    })
  })

  describe('When called with a single target UUID', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop'],
      relationship: 'skos:broader'
    }

    test('should generate a query with correct number of URI occurrences', () => {
      const result = getCreateRelationshipQuery(params)
      const uriCount = (result.match(/https:\/\/gcmd\.earthdata\.nasa\.gov\/kms\/concept/g) || []).length
      expect(uriCount).toBe(6) // Two in INSERT, two in WHERE, two in FILTER NOT EXISTS
    })
  })

  describe('When called with multiple target UUIDs', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop', 'qrst-uvwx-yz12-3456', '7890-1234-5678-9012'],
      relationship: 'skos:broader'
    }

    test('should generate a query with correct number of URI occurrences', () => {
      const result = getCreateRelationshipQuery(params)
      const uriCount = (result.match(/https:\/\/gcmd\.earthdata\.nasa\.gov\/kms\/concept/g) || []).length
      expect(uriCount).toBe(16)
    })
  })

  describe('When called with a different relationship', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop'],
      relationship: 'custom:relation'
    }

    test('should use the provided relationship in the query', () => {
      const result = getCreateRelationshipQuery(params)
      expect(result).toContain('custom:relation')
    })
  })

  describe('Query structure', () => {
    const params = {
      sourceUuid: '1234-5678-90ab-cdef',
      targetUuids: ['abcd-efgh-ijkl-mnop', 'qrst-uvwx-yz12-3456'],
      relationship: 'skos:broader'
    }

    const result = getCreateRelationshipQuery(params)

    test('should have the correct overall structure', () => {
      expect(result).toMatch(/INSERT\s*{\s*.*\s*}\s*WHERE\s*{\s*.*\s*FILTER NOT EXISTS\s*{\s*.*\s*}\s*}/s)
    })

    test('should check existence of source concept', () => {
      expect(result).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${params.sourceUuid}> a ?sourceType .`)
    })

    test('should check existence of all target concepts', () => {
      params.targetUuids.forEach((uuid, index) => {
        expect(result).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> a ?targetType${index + 1} .`)
      })
    })
  })
})
