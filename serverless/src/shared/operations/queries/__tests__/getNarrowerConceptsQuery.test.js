import { describe, expect } from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getNarrowerConceptsQuery } from '../getNarrowerConceptsQuery'

describe('getNarrowerConceptsQuery', () => {
  test('should return the correct query without a scheme', () => {
    const result = getNarrowerConceptsQuery()
    expect(result).toEqual(`
  ${prefixes}
  SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ?subject skos:narrower ?narrower .
    ?narrower skos:prefLabel ?narrowerPrefLabel .
    
  }
`)
  })

  test('should return the correct query with a scheme', () => {
    const scheme = 'test_scheme'
    const result = getNarrowerConceptsQuery(scheme)
    expect(result).toEqual(`
  ${prefixes}
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
