import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getCreateRelationshipQuery } from '../getCreateRelationshipQuery'

describe('getCreateRelationshipQuery', () => {
  const sourceUuid = 'source123'
  const targetUuids = ['target456', 'target789']
  const relationship = '<http://example.com/relation>'
  const inverseRelationship = '<http://example.com/inverseRelation>'

  describe('When called with valid parameters', () => {
    const result = getCreateRelationshipQuery({
      sourceUuid,
      targetUuids,
      relationship,
      inverseRelationship
    })

    test('should include prefixes', () => {
      expect(result).toContain(prefixes)
    })

    test('should create direct triples', () => {
      expect(result).toContain('<https://gcmd.earthdata.nasa.gov/kms/concept/source123> <http://example.com/relation> <https://gcmd.earthdata.nasa.gov/kms/concept/target456> .')
      expect(result).toContain('<https://gcmd.earthdata.nasa.gov/kms/concept/source123> <http://example.com/relation> <https://gcmd.earthdata.nasa.gov/kms/concept/target789> .')
    })

    test('should create inverse triples', () => {
      expect(result).toContain('<https://gcmd.earthdata.nasa.gov/kms/concept/target456> <http://example.com/inverseRelation> <https://gcmd.earthdata.nasa.gov/kms/concept/source123> .')
      expect(result).toContain('<https://gcmd.earthdata.nasa.gov/kms/concept/target789> <http://example.com/inverseRelation> <https://gcmd.earthdata.nasa.gov/kms/concept/source123> .')
    })

    test('should include INSERT clause', () => {
      expect(result).toContain('INSERT {')
    })

    test('should include empty WHERE clause', () => {
      expect(result).toContain('WHERE {\n    # Do not filter\n  }')
    })
  })

  describe('When called with empty targetUuids', () => {
    const result = getCreateRelationshipQuery({
      sourceUuid,
      targetUuids: [],
      relationship,
      inverseRelationship
    })

    test('should not create any triples', () => {
      expect(result).not.toContain('<https://gcmd.earthdata.nasa.gov/kms/concept/')
    })
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid sourceUuid', () => {
      expect(() => getCreateRelationshipQuery({
        sourceUuid: 123,
        targetUuids: ['target456'],
        relationship: '<http://example.com/relation>',
        inverseRelationship: '<http://example.com/inverseRelation>'
      })).toThrow('Invalid sourceUuid provided')
    })

    test('should throw an error for an invalid targetUuid in targetUuids', () => {
      expect(() => getCreateRelationshipQuery({
        sourceUuid: 'source123',
        targetUuids: [123],
        relationship: '<http://example.com/relation>',
        inverseRelationship: '<http://example.com/inverseRelation>'
      })).toThrow('Invalid targetUuid provided')
    })
  })
})
