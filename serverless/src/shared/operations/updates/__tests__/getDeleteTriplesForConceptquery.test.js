import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getDeleteTriplesForConceptQuery } from '../getDeleteTriplesForConceptQuery'

describe('getDeleteTriplesForConceptQuery', () => {
  test('should generate correct delete query for a valid concept IRI', () => {
    const conceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/123-abc'
    const query = getDeleteTriplesForConceptQuery(conceptIRI)

    expect(query).toContain(prefixes)
    expect(query).toContain('DELETE {')
    expect(query).toContain('?s ?p ?o .')
    expect(query).toContain(`FILTER(?s = <${conceptIRI}>)`)
    expect(query).toContain(`FILTER(?o = <${conceptIRI}>)`)
  })

  test('should throw an error for an invalid concept IRI', () => {
    const invalidIRI = 'invalid-iri'
    expect(() => getDeleteTriplesForConceptQuery(invalidIRI)).toThrow('Invalid conceptIRI provided')
  })

  test('should throw an error when conceptIRI is not a string (other than null or undefined)', () => {
    expect(() => getDeleteTriplesForConceptQuery(123)).toThrow('Invalid conceptIRI provided')
    expect(() => getDeleteTriplesForConceptQuery({})).toThrow('Invalid conceptIRI provided')
  })

  test('should handle missing or empty conceptIRI gracefully without throwing', () => {
    expect(() => getDeleteTriplesForConceptQuery(null)).not.toThrow()
    expect(() => getDeleteTriplesForConceptQuery(undefined)).not.toThrow()
    expect(() => getDeleteTriplesForConceptQuery('')).not.toThrow()
  })
})
