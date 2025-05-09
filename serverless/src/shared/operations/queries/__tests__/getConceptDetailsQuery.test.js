import {
  describe,
  expect,
  test
} from 'vitest'

import { getConceptDetailsQuery } from '@/shared/operations/queries/getConceptDetailsQuery'

describe('when generating details query', () => {
  test('should generate correct query with given URIs', () => {
    const uris = [
      'http://example.com/concept1',
      'http://example.com/concept2'
    ]
    const query = getConceptDetailsQuery(uris)

    expect(query).toContain('SELECT DISTINCT ?s ?p ?o')
    expect(query).toContain('VALUES ?s { <http://example.com/concept1>\n<http://example.com/concept2> }')
    expect(query).toContain('UNION')
    expect(query).toContain('FILTER(isBlank(?s))')
  })

  test('should handle empty URI list', () => {
    const query = getConceptDetailsQuery([])

    expect(query).toContain('VALUES ?s {  }')
  })
})
