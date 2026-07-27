import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getUpdatePrefLabelQuery } from '../getUpdatePrefLabelQuery'

describe('getUpdatePrefLabelQuery', () => {
  test('should generate correct update prefLabel query for valid inputs', () => {
    const conceptId = 'concept-123'
    const prefLabel = 'Test Concept'
    const query = getUpdatePrefLabelQuery(conceptId, prefLabel)

    expect(query).toContain(prefixes)
    expect(query).toContain('DELETE {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> skos:prefLabel ?oldLabel .`)
    expect(query).toContain('INSERT {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> skos:prefLabel "${prefLabel}"@en .`)
    expect(query).toContain('WHERE {')
  })

  test('should throw an error for an invalid conceptId', () => {
    expect(() => getUpdatePrefLabelQuery(123, 'Test Concept')).toThrow('Invalid conceptId provided')
  })

  test('should handle missing or empty conceptId gracefully without throwing', () => {
    expect(() => getUpdatePrefLabelQuery('', 'Test Concept')).not.toThrow()
    expect(() => getUpdatePrefLabelQuery(null, 'Test Concept')).not.toThrow()
    expect(() => getUpdatePrefLabelQuery(undefined, 'Test Concept')).not.toThrow()
  })

  test('should throw an error for an invalid prefLabel', () => {
    expect(() => getUpdatePrefLabelQuery('concept-123', null)).toThrow('Invalid prefLabel provided')
  })
})
