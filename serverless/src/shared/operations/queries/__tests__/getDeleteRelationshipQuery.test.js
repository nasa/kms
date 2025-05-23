import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getDeleteRelationshipQuery } from '../getDeleteRelationshipQuery'

describe('getDeleteRelationshipQuery', () => {
  describe('When called with valid parameters', () => {
    const sourceUuid = 'source123'
    const targetUuids = ['target456', 'target789']
    const relationship = 'skos:broader'
    const inverseRelationship = 'skos:narrower'

    const result = getDeleteRelationshipQuery({
      sourceUuid,
      targetUuids,
      relationship,
      inverseRelationship
    })

    test('should include prefixes', () => {
      expect(result).toContain(prefixes)
    })

    test('should include DELETE clause', () => {
      expect(result).toContain('DELETE {')
    })

    test('should include direct triples for deletion', () => {
      targetUuids.forEach((uuid) => {
        expect(result).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}> ${relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}>`)
      })
    })

    test('should include inverse triples for deletion', () => {
      targetUuids.forEach((uuid) => {
        expect(result).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${inverseRelationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}>`)
      })
    })

    test('should include an empty WHERE clause', () => {
      expect(result).toContain('WHERE {')
      expect(result).toContain('# Empty to not filter.')
    })
  })

  describe('When called with empty targetUuids', () => {
    const result = getDeleteRelationshipQuery({
      sourceUuid: 'source123',
      targetUuids: [],
      relationship: 'skos:broader',
      inverseRelationship: 'skos:narrower'
    })

    test('should not include any triples for deletion', () => {
      expect(result).not.toContain('<https://gcmd.earthdata.nasa.gov/kms/concept/')
    })
  })
})
