import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import {
  getTriplesForShortNameQuery
} from '@/shared/operations/queries/getTriplesForShortNameQuery'

describe('getTriplesForShortNameQuery', () => {
  test('should generate correct query when shortName and scheme are provided', () => {
    const params = {
      shortName: 'testShortName',
      scheme: 'testScheme'
    }
    const query = getTriplesForShortNameQuery(params)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT DISTINCT ?s ?p ?o')
    expect(query).toContain('FILTER(LCASE(STR(?prefLabel)) = LCASE("testShortName"))')
    expect(query).toContain('?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/testScheme>')
  })

  test('should generate correct query when scheme is omitted', () => {
    const params = {
      shortName: 'testShortName'
    }
    const query = getTriplesForShortNameQuery(params)

    expect(query).toContain('FILTER(LCASE(STR(?prefLabel)) = LCASE("testShortName"))')
    expect(query).not.toContain('skos:inScheme')
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid shortName', () => {
      expect(() => getTriplesForShortNameQuery({ shortName: 123 })).toThrow('Invalid shortName provided')
    })

    test('should throw an error for an invalid scheme', () => {
      expect(() => getTriplesForShortNameQuery({
        shortName: 'test',
        scheme: 123
      })).toThrow('Invalid scheme provided')
    })
  })
})
