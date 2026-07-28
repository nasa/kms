import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import { getTriplesForAltLabelQuery } from '@/shared/operations/queries/getTriplesForAltLabelQuery'

describe('getTriplesForAltLabelQuery', () => {
  test('should generate correct query when altLabel and scheme are provided', () => {
    const params = {
      altLabel: 'testAltLabel',
      scheme: 'testScheme'
    }
    const query = getTriplesForAltLabelQuery(params)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT DISTINCT ?s ?p ?o')
    expect(query).toContain('gcmd:text "testAltLabel"@en')
    expect(query).toContain('skos:altLabel "testAltLabel"@en')
    expect(query).toContain('?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/testScheme>')
  })

  test('should generate correct query when scheme is omitted', () => {
    const params = {
      altLabel: 'testAltLabel'
    }
    const query = getTriplesForAltLabelQuery(params)

    expect(query).toContain('gcmd:text "testAltLabel"@en')
    expect(query).toContain('skos:altLabel "testAltLabel"@en')
    expect(query).not.toContain('skos:inScheme')
  })

  describe('when validation errors occur', () => {
    test('should throw an error for an invalid altLabel', () => {
      expect(() => getTriplesForAltLabelQuery({ altLabel: 123 })).toThrow('Invalid altLabel provided')
    })

    test('should throw an error for an invalid scheme', () => {
      expect(() => getTriplesForAltLabelQuery({
        altLabel: 'test',
        scheme: 123
      })).toThrow('Invalid scheme provided')
    })
  })
})
