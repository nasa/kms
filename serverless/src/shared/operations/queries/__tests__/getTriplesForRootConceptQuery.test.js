import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import {
  getTriplesForRootConceptQuery
} from '@/shared/operations/queries/getTriplesForRootConceptQuery'

describe('getTriplesForRootConceptQuery', () => {
  test('should generate correct query when a valid scheme is provided', () => {
    const scheme = 'sciencekeywords'
    const query = getTriplesForRootConceptQuery(scheme)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT DISTINCT ?s ?p ?o')
    expect(query).toContain('?s a skos:Concept .')
    expect(query).toContain(`?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .`)
    expect(query).toContain('?s ?p ?o .')
    expect(query).toContain('FILTER NOT EXISTS { ?s skos:broader ?broader }')
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid scheme', () => {
      expect(() => getTriplesForRootConceptQuery(123)).toThrow('Invalid scheme provided')
    })
  })
})
