import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getConceptIdExistsQuery } from '../getConceptIdExistsQuery'

describe('getConceptIdExistsQuery', () => {
  test('should generate correct concept existence query for valid concept IRI', () => {
    const conceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/12345'
    const query = getConceptIdExistsQuery(conceptIRI)

    expect(query).toContain(prefixes)
    expect(query).toContain(`WHERE { <${conceptIRI}> ?p ?o }`)
    expect(query).toContain('LIMIT 1')
  })

  test('should throw an error for an invalid concept IRI', () => {
    expect(() => getConceptIdExistsQuery(123)).toThrow('Invalid conceptIRI provided')
  })
})
