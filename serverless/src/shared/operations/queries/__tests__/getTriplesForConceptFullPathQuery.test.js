import {
  describe,
  expect,
  test
} from 'vitest'

import prefixes from '@/shared/constants/prefixes'

import { getTriplesForConceptFullPathQuery } from '../getTriplesForConceptFullPathQuery'

describe('getTriplesForConceptFullPathQuery', () => {
  const defaultParams = {
    levels: ['Root', 'Mid', 'Target'],
    scheme: 'test_scheme',
    targetConcept: 'Target Concept'
  }

  test('should return a string', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(typeof result).toBe('string')
  })

  test('should include prefixes', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(result).toContain(prefixes)
  })

  test('should select s, p, and o', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(result).toContain('SELECT DISTINCT ?s ?p ?o')
  })

  test('should filter root label correctly', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(result).toContain('FILTER(LCASE(STR(?rootLabel)) = LCASE("Root"))')
  })

  test('should filter scheme correctly', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(result).toContain('FILTER(LCASE(STR(?scheme)) = LCASE("https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/test_scheme"))')
  })

  test('should filter target concept correctly', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(result).toContain('FILTER(LCASE(STR(?conceptLabel)) = LCASE("Target Concept"))')
  })

  test('should handle multiple levels correctly', () => {
    const params = {
      ...defaultParams,
      levels: ['Root', 'Mid1', 'Mid2', 'Target']
    }
    const result = getTriplesForConceptFullPathQuery(params)
    expect(result).toContain('?mid0 skos:prefLabel ?midLabel0')
    expect(result).toContain('?mid1 skos:prefLabel ?midLabel1')
    expect(result).not.toContain('?mid2')
  })

  test('should include UNION for blank nodes', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(result).toContain('UNION')
    expect(result).toContain('FILTER(isBlank(?bnode))')
  })

  test('should limit the subquery to 1 result', () => {
    const result = getTriplesForConceptFullPathQuery(defaultParams)
    expect(result).toContain('LIMIT 1')
  })
})
