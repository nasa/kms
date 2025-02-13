// Serverless/src/utils/__tests__/prefixNode.test.js

import prefixNode from '../prefixNode'

describe('prefixNode', () => {
  test('should replace SKOS prefix with its alias', () => {
    const input = 'http://www.w3.org/2004/02/skos/core#broader'
    const expected = 'skos:broader'
    expect(prefixNode(input)).toBe(expected)
  })

  test('should replace RDF prefix with its alias', () => {
    const input = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    const expected = 'rdf:type'
    expect(prefixNode(input)).toBe(expected)
  })

  test('should replace GCMD prefix with its alias', () => {
    const input = 'https://gcmd.earthdata.nasa.gov/kms#concept'
    const expected = 'gcmd:concept'
    expect(prefixNode(input)).toBe(expected)
  })

  test('should handle predicates with multiple known prefixes', () => {
    const input = 'http://www.w3.org/2004/02/skos/core#inScheme http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    const expected = 'skos:inScheme rdf:type'
    expect(prefixNode(input)).toBe(expected)
  })

  test('should return the original predicate if no known prefix is found', () => {
    const input = 'http://example.com/unknown'
    expect(prefixNode(input)).toBe(input)
  })

  test('should handle empty string input', () => {
    expect(prefixNode('')).toBe('')
  })

  test('should handle input with partial match to known prefix', () => {
    const input = 'http://www.w3.org/2004/02/skos/core'
    expect(prefixNode(input)).toBe(input)
  })
})
