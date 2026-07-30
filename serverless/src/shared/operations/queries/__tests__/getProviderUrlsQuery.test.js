import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import { getProviderUrlsQuery } from '@/shared/operations/queries/getProviderUrlsQuery'

describe('getProviderUrlsQuery', () => {
  test('should generate correct query when a valid scheme is provided', () => {
    const scheme = 'sciencekeywords'
    const query = getProviderUrlsQuery(scheme)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT ?subject ?bp ?bo')
    expect(query).toContain('?subject skos:inScheme ?schemeUri .')
    expect(query).toContain(`FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}>)))`)
    expect(query).toContain('?subject gcmd:resource ?blankNode .')
    expect(query).toContain('?blankNode ?bp ?bo')
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid scheme', () => {
      expect(() => getProviderUrlsQuery(123)).toThrow('Invalid scheme provided')
    })
  })
})
