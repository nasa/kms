import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import { getTriplesForConceptQuery } from '@/shared/operations/queries/getTriplesForConceptQuery'

describe('getTriplesForConceptQuery', () => {
  test('should generate correct query when a valid conceptIRI is provided', () => {
    const conceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/12345'
    const query = getTriplesForConceptQuery(conceptIRI)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT DISTINCT ?s ?p ?o')
    expect(query).toContain(`<${conceptIRI}> ?p ?o .`)
    expect(query).toContain(`BIND(<${conceptIRI}> AS ?s)`)
    expect(query).toContain('UNION')
    expect(query).toContain(`<${conceptIRI}> ?p1 ?bnode .`)
    expect(query).toContain('?bnode ?p ?o .')
    expect(query).toContain('BIND(?bnode AS ?s)')
    expect(query).toContain('FILTER(isBlank(?bnode))')
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid conceptIRI', () => {
      expect(() => getTriplesForConceptQuery(123)).toThrow('Invalid conceptIRI provided')
    })
  })
})
