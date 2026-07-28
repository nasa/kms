import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import {
  getSchemeUpdateModifiedDateQuery
} from '@/shared/operations/queries/getSchemeUpdateModifiedDateQuery'

describe('getSchemeUpdateModifiedDateQuery', () => {
  test('should generate correct query when valid schemeId and date are provided', () => {
    const schemeId = 'sciencekeywords'
    const date = '2023-06-01'
    const query = getSchemeUpdateModifiedDateQuery(schemeId, date)

    expect(query).toContain(prefixes)
    expect(query).toContain('DELETE {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> dcterms:modified ?oldDate .`)
    expect(query).toContain('INSERT {')
    expect(query).toContain(`<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> dcterms:modified "${date}"^^xsd:date .`)
    expect(query).toContain('WHERE {')
    expect(query).toContain('OPTIONAL {')
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid schemeId', () => {
      expect(() => getSchemeUpdateModifiedDateQuery(123, '2023-06-01')).toThrow('Invalid schemeId provided')
    })

    test('should throw an error for an invalid date', () => {
      expect(() => getSchemeUpdateModifiedDateQuery('sciencekeywords', 123)).toThrow('Invalid date provided')
    })
  })
})
