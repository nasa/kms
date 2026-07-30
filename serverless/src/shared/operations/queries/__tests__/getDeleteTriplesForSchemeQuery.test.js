import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import {
  getDeleteTriplesForSchemeQuery
} from '@/shared/operations/queries/getDeleteTriplesForSchemeQuery'

describe('getDeleteTriplesForSchemeQuery', () => {
  test('should generate correct query when a valid schemeIRI is provided', () => {
    const schemeIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords'
    const query = getDeleteTriplesForSchemeQuery(schemeIRI)

    expect(query).toContain(prefixes)
    expect(query).toContain('DELETE {')
    expect(query).toContain('?s ?p ?o .')
    expect(query).toContain('WHERE {')
    expect(query).toContain(`FILTER(?s = <${schemeIRI}>)`)
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid schemeIRI', () => {
      expect(() => getDeleteTriplesForSchemeQuery(123)).toThrow('Invalid schemeIRI provided')
    })
  })
})
