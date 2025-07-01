import {
  describe,
  expect,
  test
} from 'vitest'

import { getRootConceptsBySchemeQuery } from '../getRootConceptsBySchemeQuery'

describe('getRootConceptsBySchemeQuery', () => {
  test('should generate a query without scheme filter when no scheme is provided', () => {
    const query = getRootConceptsBySchemeQuery()
    expect(query).toContain('SELECT ?subject ?prefLabel')
    expect(query).not.toContain('?subject skos:inScheme ?schemeUri')
    expect(query).toContain('FILTER EXISTS {\n        ?subject skos:inScheme ?scheme .\n      }')
  })

  test('should generate a query with case-insensitive scheme filter when a scheme is provided', () => {
    const scheme = 'testScheme'
    const query = getRootConceptsBySchemeQuery(scheme)
    expect(query).toContain('SELECT ?subject ?prefLabel')
    expect(query).toContain('?subject skos:inScheme ?schemeUri')
    expect(query).toContain(`FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}>)))`)
    expect(query).not.toContain('FILTER EXISTS {\n        ?subject skos:inScheme ?scheme .\n      }')
  })

  test('should include FILTER NOT EXISTS for broader concepts in both cases', () => {
    const queryWithoutScheme = getRootConceptsBySchemeQuery()
    const queryWithScheme = getRootConceptsBySchemeQuery('testScheme')

    const filterNotExistsClause = 'FILTER NOT EXISTS {\n      ?subject skos:broader ?broaderConcept .\n    }'

    expect(queryWithoutScheme).toContain(filterNotExistsClause)
    expect(queryWithScheme).toContain(filterNotExistsClause)
  })
})
