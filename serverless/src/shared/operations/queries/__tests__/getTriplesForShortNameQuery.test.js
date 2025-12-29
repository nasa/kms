import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getTriplesForShortNameQuery } from '../getTriplesForShortNameQuery'

describe('getTriplesForShortNameQuery', () => {
  // Helper function to remove all whitespace
  const removeWhitespace = (str) => str.replace(/\s+/g, '')

  test('should return the correct query without a scheme', () => {
    const result = getTriplesForShortNameQuery({ shortName: 'testName' })
    const expected = `
      ${prefixes}
      SELECT DISTINCT ?s ?p ?o
      WHERE {
        {
          SELECT DISTINCT ?concept
          WHERE {
            ?concept skos:prefLabel ?prefLabel .
            FILTER(LCASE(STR(?prefLabel)) = LCASE("testName"))
          }
          LIMIT 1
        }
        
        {
          ?concept ?p ?o .
          BIND(?concept AS ?s)
        }
        UNION
        {
          ?concept ?p1 ?bnode .
          ?bnode ?p ?o .
          BIND(?bnode AS ?s)
          FILTER(isBlank(?bnode))
        }
      }
    `
    expect(removeWhitespace(result)).toEqual(removeWhitespace(expected))
  })

  test('should return the correct query with a scheme', () => {
    const result = getTriplesForShortNameQuery({
      shortName: 'testName',
      scheme: 'testScheme'
    })
    const expected = `
      ${prefixes}
      SELECT DISTINCT ?s ?p ?o
      WHERE {
        {
          SELECT DISTINCT ?concept
          WHERE {
            ?concept skos:prefLabel ?prefLabel .
            FILTER(LCASE(STR(?prefLabel)) = LCASE("testName"))
            ?concept skos:inScheme ?schemeUri . 
            FILTER(LCASE(STR(?schemeUri)) = LCASE("https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/testScheme"))
          }
          LIMIT 1
        }
        
        {
          ?concept ?p ?o .
          BIND(?concept AS ?s)
        }
        UNION
        {
          ?concept ?p1 ?bnode .
          ?bnode ?p ?o .
          BIND(?bnode AS ?s)
          FILTER(isBlank(?bnode))
        }
      }
    `
    expect(removeWhitespace(result)).toEqual(removeWhitespace(expected))
  })
})
