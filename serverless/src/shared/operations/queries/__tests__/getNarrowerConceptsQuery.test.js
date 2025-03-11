// GetNarrowerConceptsQuery.test.js

import {
  describe,
  expect,
  it
} from 'vitest'

import { getNarrowerConceptsQuery } from '../getNarrowerConceptsQuery'

describe('getNarrowerConceptsQuery', () => {
  it('should return the correct query without a scheme', () => {
    const result = getNarrowerConceptsQuery()
    expect(result).toEqual(`
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ?subject skos:narrower ?narrower .
    ?narrower skos:prefLabel ?narrowerPrefLabel .
    
  }
`)
  })

  it('should return the correct query with a scheme', () => {
    const scheme = 'test_scheme'
    const result = getNarrowerConceptsQuery(scheme)
    expect(result).toEqual(`
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ?subject skos:narrower ?narrower .
    ?narrower skos:prefLabel ?narrowerPrefLabel .
    
    ?subject skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/test_scheme> .
    
  }
`)
  })
})
