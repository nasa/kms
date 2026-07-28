import {
  describe,
  expect,
  test
} from 'vitest'

import { getConceptChangeNotesQuery } from '../getConceptChangeNotesQuery'

describe('getConceptChangeNotesQuery', () => {
  test('should generate correct query when schemeIRI is provided', () => {
    const schemeIRI = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords'
    const query = getConceptChangeNotesQuery(schemeIRI)

    expect(query).toContain('SELECT DISTINCT ?concept ?p ?changeNote')
    expect(query).toContain('?concept a <http://www.w3.org/2004/02/skos/core#Concept>')
    expect(query).toContain('?concept <http://www.w3.org/2004/02/skos/core#changeNote> ?changeNote')
    expect(query).toContain(`?concept <http://www.w3.org/2004/02/skos/core#inScheme> <${schemeIRI}>`)
  })

  test('should generate correct query when schemeIRI is omitted', () => {
    const query = getConceptChangeNotesQuery()

    expect(query).toContain('SELECT DISTINCT ?concept ?p ?changeNote')
    expect(query).toContain('?concept a <http://www.w3.org/2004/02/skos/core#Concept>')
    expect(query).toContain('?concept <http://www.w3.org/2004/02/skos/core#changeNote> ?changeNote')
    expect(query).not.toContain('inScheme')
  })

  test('should throw an error for an invalid schemeIRI', () => {
    expect(() => getConceptChangeNotesQuery(123)).toThrow('Invalid schemeIRI provided')
  })
})
