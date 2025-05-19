import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getConceptsQuery } from '../getConceptsQuery'

describe('getConceptsQuery', () => {
  describe('when concept scheme is provided', () => {
    test('should include the concept scheme in the query', () => {
      const conceptScheme = 'https://example.com/scheme'
      const query = getConceptsQuery(conceptScheme)
      expect(query).toContain(`?s skos:inScheme <${conceptScheme}>`)
    })
  })

  describe('when pattern is provided', () => {
    test('should include the pattern filter in the query', () => {
      const pattern = 'test pattern'
      const query = getConceptsQuery(null, pattern)
      expect(query).toContain(`FILTER(CONTAINS(LCASE(?prefLabel), LCASE("${pattern}")))`)
    })
  })

  describe('when limit and offset are provided', () => {
    test('should include the correct limit and offset in the query', () => {
      const limit = 50
      const offset = 100
      const query = getConceptsQuery(null, null, limit, offset)
      expect(query).toContain(`LIMIT ${limit}`)
      expect(query).toContain(`OFFSET ${offset}`)
    })
  })

  describe('when requesting all concepts', () => {
    test('should generate a query without concept scheme or pattern filters', () => {
      const query = getConceptsQuery()
      expect(query).not.toContain('skos:inScheme')
      expect(query).not.toContain('FILTER(CONTAINS')
      expect(query).toContain('LIMIT 1000')
      expect(query).toContain('OFFSET 0')
    })
  })

  test('should include prefixes, SELECT, and WHERE clauses', () => {
    const query = getConceptsQuery()
    expect(query).toContain(prefixes)
    expect(query).toContain('SELECT ?bn ?bp ?bo ?s ?p ?o')
    expect(query).toContain('WHERE {')
  })

  test('should include blank node handling', () => {
    const query = getConceptsQuery()
    expect(query).toContain('BIND(?o AS ?bn)')
    expect(query).toContain('FILTER(isBlank(?bn))')
    expect(query).toContain('?bn ?bp ?bo')
    expect(query).toContain('FILTER(?bn != ?bo)')
  })
})
