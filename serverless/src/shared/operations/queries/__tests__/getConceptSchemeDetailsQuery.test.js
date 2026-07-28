import {
  describe,
  expect,
  test
} from 'vitest'

import { prefixes } from '@/shared/constants/prefixes'

import { getConceptSchemeDetailsQuery } from '../getConceptSchemeDetailsQuery'

describe('getConceptSchemeDetailsQuery', () => {
  test('should generate correct concept scheme details query for valid scheme name', () => {
    const schemeName = 'sciencekeywords'
    const query = getConceptSchemeDetailsQuery(schemeName)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT ?scheme ?prefLabel ?notation ?modified ?csvHeaders')
    expect(query).toContain('?scheme a skos:ConceptScheme')
    expect(query).toContain(`FILTER(LCASE(STR(?notation)) = LCASE("${schemeName}"))`)
  })

  test('should throw an error for an invalid scheme name', () => {
    expect(() => getConceptSchemeDetailsQuery(123)).toThrow('Invalid scheme provided')
  })
})
