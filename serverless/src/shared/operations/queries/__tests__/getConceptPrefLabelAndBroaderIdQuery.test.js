import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getConceptPrefLabelAndBroaderIdQuery } from '../getConceptPrefLabelAndBroaderIdQuery'

describe('getConceptPrefLabelAndBroaderIdQuery', () => {
  test('should generate correct query for valid concept IRI', () => {
    const conceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/12345'
    const query = getConceptPrefLabelAndBroaderIdQuery(conceptIRI)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT ?s ?prefLabel ?broader WHERE {')
    expect(query).toContain(`<${conceptIRI}> skos:prefLabel ?prefLabel .`)
    expect(query).toContain('OPTIONAL {')
    expect(query).toContain(`<${conceptIRI}> skos:broader ?broader .`)
  })

  test('should throw an error for an invalid concept IRI', () => {
    expect(() => getConceptPrefLabelAndBroaderIdQuery(123)).toThrow('Invalid conceptIRI provided')
  })
})
