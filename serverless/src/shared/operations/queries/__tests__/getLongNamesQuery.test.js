import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import { getLongNamesQuery } from '@/shared/operations/queries/getLongNamesQuery'

describe('getLongNamesQuery', () => {
  test('should generate correct query when a valid scheme is provided', () => {
    const scheme = 'sciencekeywords'
    const query = getLongNamesQuery(scheme)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT ?subject ?longName')
    expect(query).toContain('?subject skos:inScheme ?schemeUri .')
    expect(query).toContain(`FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}>)))`)
    expect(query).toContain('?subject gcmd:altLabel ?blankNode .')
    expect(query).toContain('?blankNode gcmd:category "primary"@en .')
    expect(query).toContain('?blankNode gcmd:text ?longName .')
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid scheme', () => {
      expect(() => getLongNamesQuery(123)).toThrow('Invalid scheme provided')
    })
  })
})
