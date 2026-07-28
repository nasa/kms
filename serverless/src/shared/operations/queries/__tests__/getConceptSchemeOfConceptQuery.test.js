import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getConceptSchemeOfConceptQuery } from '../getConceptSchemeOfConceptQuery'

describe('getConceptSchemeOfConceptQuery', () => {
  test('should generate correct concept scheme query for valid concept IRI', () => {
    const conceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/12345'
    const query = getConceptSchemeOfConceptQuery(conceptIRI)

    expect(query).toContain(prefixes)
    expect(query).toContain('WHERE {')
    expect(query).toContain(`<${conceptIRI}> skos:inScheme ?scheme .`)
    expect(query).toContain('LIMIT 1')
  })

  test('should throw an error for an invalid concept IRI', () => {
    expect(() => getConceptSchemeOfConceptQuery(123)).toThrow('Invalid conceptIRI provided')
  })
})
