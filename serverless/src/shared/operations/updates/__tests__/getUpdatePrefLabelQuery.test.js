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
    expect(() => getUpdatePrefLabelQuery('', 'Test Concept')).toThrow('Invalid conceptId provided')
    expect(() => getUpdatePrefLabelQuery(null, 'Test Concept')).toThrow('Invalid conceptId provided')
  })

  test('should throw an error for an invalid prefLabel', () => {
    expect(() => getUpdatePrefLabelQuery('concept-123', '')).toThrow('Invalid prefLabel provided')
    expect(() => getUpdatePrefLabelQuery('concept-123', null)).toThrow('Invalid prefLabel provided')
  })
})
