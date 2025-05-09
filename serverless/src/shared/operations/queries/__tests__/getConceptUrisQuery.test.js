import {
  describe,
  expect,
  test
} from 'vitest'

import { getConceptUrisQuery } from '@/shared/operations/queries/getConceptUrisQuery'

describe('when generating uri query', () => {
  test('should generate correct query with all parameters', () => {
    const query = getConceptUrisQuery({
      conceptScheme: 'sciencekeywords',
      pattern: 'earth',
      pageSize: 10,
      offset: 20
    })

    expect(query).toContain('SELECT DISTINCT ?s')
    expect(query).toContain('?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords>')
    expect(query).toContain('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("earth")))')
    expect(query).toContain('LIMIT 10')
    expect(query).toContain('OFFSET 20')
  })

  test('should generate correct query without pattern', () => {
    const query = getConceptUrisQuery({
      conceptScheme: 'sciencekeywords',
      pageSize: 10,
      offset: 0
    })

    expect(query).not.toContain('FILTER(CONTAINS')
  })

  test('should generate correct query without conceptScheme', () => {
    const query = getConceptUrisQuery({
      pattern: 'earth',
      pageSize: 10,
      offset: 0
    })

    expect(query).not.toContain('skos:inScheme')
  })
})
