import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getUpdateCreatedDateQuery } from '../getUpdateCreatedDateQuery'

describe('getUpdateCreatedDateQuery', () => {
  test('should generate correct update created date query for valid inputs', () => {
    const conceptId = 'concept-123'
    const date = '2026-07-27'
    const query = getUpdateCreatedDateQuery(conceptId, date)

    expect(query).toContain(prefixes)
    expect(query).toContain('DELETE {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:created ?oldDate .`)
    expect(query).toContain('INSERT {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:created "${date}"^^xsd:date .`)
    expect(query).toContain('WHERE {')
  })

  test('should throw an error for an invalid conceptId', () => {
    expect(() => getUpdateCreatedDateQuery('', '2026-07-27')).toThrow('Invalid conceptId provided')
    expect(() => getUpdateCreatedDateQuery(null, '2026-07-27')).toThrow('Invalid conceptId provided')
  })

  test('should throw an error for an invalid date', () => {
    expect(() => getUpdateCreatedDateQuery('concept-123', '')).toThrow('Invalid date provided')
    expect(() => getUpdateCreatedDateQuery('concept-123', null)).toThrow('Invalid date provided')
  })
})
