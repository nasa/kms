import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getUpdateModifiedDateQuery } from '../getUpdateModifiedDateQuery'

describe('getUpdateModifiedDateQuery', () => {
  test('should generate correct update modified date query for valid inputs', () => {
    const conceptId = 'concept-123'
    const date = '2026-07-27'
    const query = getUpdateModifiedDateQuery(conceptId, date)

    expect(query).toContain(prefixes)
    expect(query).toContain('DELETE {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:modified ?oldDate .`)
    expect(query).toContain('INSERT {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:modified "${date}"^^xsd:date .`)
    expect(query).toContain('WHERE {')
  })

  test('should throw an error for an invalid conceptId', () => {
    expect(() => getUpdateModifiedDateQuery('', '2026-07-27')).toThrow('Invalid conceptId provided')
    expect(() => getUpdateModifiedDateQuery(null, '2026-07-27')).toThrow('Invalid conceptId provided')
  })

  test('should throw an error for an invalid date', () => {
    expect(() => getUpdateModifiedDateQuery('concept-123', '')).toThrow('Invalid date provided')
    expect(() => getUpdateModifiedDateQuery('concept-123', null)).toThrow('Invalid date provided')
  })
})
