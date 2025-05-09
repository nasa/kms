import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'
import { getTotalCountQuery } from '@/shared/operations/queries/getTotalCountQuery'

describe('when generating total count query', () => {
  test('should generate correct query with both conceptScheme and pattern', () => {
    const params = {
      conceptScheme: 'sciencekeywords',
      pattern: 'Earth'
    }
    const query = getTotalCountQuery(params)

    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT (COUNT(DISTINCT ?s) as ?count)')
    expect(query).toContain('?s rdf:type skos:Concept')
    expect(query).toContain('?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords>')
    expect(query).toContain('?s skos:prefLabel ?prefLabel')
    expect(query).toContain('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("Earth")))')
  })

  test('should generate correct query with only conceptScheme', () => {
    const params = {
      conceptScheme: 'platforms'
    }
    const query = getTotalCountQuery(params)

    expect(query).toContain('?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms>')
    expect(query).not.toContain('skos:prefLabel')
    expect(query).not.toContain('FILTER(CONTAINS')
  })

  test('should generate correct query with only pattern', () => {
    const params = {
      pattern: 'Atmosphere'
    }
    const query = getTotalCountQuery(params)

    expect(query).not.toContain('skos:inScheme')
    expect(query).toContain('?s skos:prefLabel ?prefLabel')
    expect(query).toContain('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("Atmosphere")))')
  })

  test('should generate correct query without conceptScheme and pattern', () => {
    const params = {}
    const query = getTotalCountQuery(params)

    expect(query).toContain('SELECT (COUNT(DISTINCT ?s) as ?count)')
    expect(query).toContain('?s rdf:type skos:Concept')
    expect(query).not.toContain('skos:inScheme')
    expect(query).not.toContain('skos:prefLabel')
    expect(query).not.toContain('FILTER(CONTAINS')
  })

  test('should handle special characters in pattern', () => {
    const params = {
      pattern: 'Earth & Space'
    }
    const query = getTotalCountQuery(params)

    expect(query).toContain('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("Earth & Space")))')
  })
})
