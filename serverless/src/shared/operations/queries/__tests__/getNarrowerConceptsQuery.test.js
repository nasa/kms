import { describe, expect } from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getNarrowerConceptsQuery } from '../getNarrowerConceptsQuery'

describe('getNarrowerConceptsQuery', () => {
  // Helper function to remove all whitespace
  const removeWhitespace = (str) => str.replace(/\s+/g, '')

  test('should return the correct query without a scheme', () => {
    const result = getNarrowerConceptsQuery()
    const expected = `
      ${prefixes}
      SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
      WHERE {
        ?subject skos:prefLabel ?prefLabel .
        ?subject skos:narrower ?narrower .
        ?narrower skos:prefLabel ?narrowerPrefLabel .
      }
    `
    expect(removeWhitespace(result)).toEqual(removeWhitespace(expected))
  })

  test('should return the correct query with a scheme', () => {
    const scheme = 'test_scheme'
    const result = getNarrowerConceptsQuery(scheme)
    const expected = `
      ${prefixes}
      SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
      WHERE {
        ?subject skos:prefLabel ?prefLabel .
        ?subject skos:narrower ?narrower .
        ?narrower skos:prefLabel ?narrowerPrefLabel .
        ?subject skos:inScheme ?schemeUri .
        FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/test_scheme>)))
      }
    `
    expect(removeWhitespace(result)).toEqual(removeWhitespace(expected))
  })
})
