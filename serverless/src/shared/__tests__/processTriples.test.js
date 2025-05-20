import {
  describe,
  expect,
  test
} from 'vitest'

import { processTriples } from '../processTriples'

describe('processTriples', () => {
  const sampleTriples = [
    {
      s: {
        value: 'http://example.com/concept1',
        type: 'uri'
      },
      p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
      o: { value: 'Concept 1' }
    },
    {
      s: {
        value: 'http://example.com/concept1',
        type: 'uri'
      },
      p: { value: 'http://www.w3.org/2004/02/skos/core#definition' },
      o: { value: 'Definition 1' }
    },
    {
      s: {
        value: 'http://example.com/concept2',
        type: 'uri'
      },
      p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
      o: { value: 'Concept 2' }
    },
    {
      s: {
        value: 'http://example.com/concept2',
        type: 'uri'
      },
      p: { value: 'http://example.com/hasPart' },
      o: {
        value: '_:bnode1',
        type: 'bnode'
      }
    },
    {
      s: {
        value: 'http://example.com/concept2',
        type: 'uri'
      },
      p: { value: 'http://example.com/hasPart' },
      o: {
        value: '_:bnode1',
        type: 'bnode'
      },
      bn: {
        value: '_:bnode1',
        type: 'bnode'
      },
      bp: { value: 'http://example.com/name' },
      bo: { value: 'Part Name' }
    },
    {
      s: {
        value: 'http://example.com/concept2',
        type: 'uri'
      },
      p: { value: 'http://example.com/hasPart' },
      o: {
        value: '_:bnode1',
        type: 'bnode'
      },
      bn: {
        value: '_:bnode1',
        type: 'bnode'
      },
      bp: { value: 'http://example.com/value' },
      bo: { value: 'Part Value' }
    },
    {
      s: {
        value: 'http://example.com/nonConcept',
        type: 'uri'
      },
      p: { value: 'http://example.com/someProperty' },
      o: { value: 'Some Value' }
    }
  ]

  test('should process triples correctly', () => {
    const result = processTriples(sampleTriples)

    // Test conceptURIs
    expect(result.conceptURIs).toEqual(['http://example.com/concept1', 'http://example.com/concept2'])

    // Test nodes
    expect(Object.keys(result.nodes)).toEqual([
      'http://example.com/concept1',
      'http://example.com/concept2',
      'http://example.com/nonConcept'
    ])

    expect(result.nodes['http://example.com/concept1']).toHaveLength(2)
    expect(result.nodes['http://example.com/concept2']).toHaveLength(2)
    expect(result.nodes['http://example.com/nonConcept']).toHaveLength(1)

    // Test bNodeMap
    expect(Object.keys(result.bNodeMap)).toEqual(['_:bnode1'])
    expect(result.bNodeMap['_:bnode1']).toHaveLength(2)
  })

  test('should deduplicate triples', () => {
    const triplesWithDuplicates = [
      ...sampleTriples,
      {
        s: {
          value: 'http://example.com/concept1',
          type: 'uri'
        },
        p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
        o: { value: 'Concept 1' }
      }
    ]

    const result = processTriples(triplesWithDuplicates)

    expect(result.nodes['http://example.com/concept1']).toHaveLength(2) // Still 2, not 3
  })

  test('should handle triples with blank nodes correctly', () => {
    const result = processTriples(sampleTriples)

    expect(result.bNodeMap['_:bnode1']).toHaveLength(2)
    expect(result.bNodeMap['_:bnode1'][0]).toEqual({
      s: {
        value: '_:bnode1',
        type: 'bnode'
      },
      p: { value: 'http://example.com/name' },
      o: { value: 'Part Name' }
    })

    expect(result.bNodeMap['_:bnode1'][1]).toEqual({
      s: {
        value: '_:bnode1',
        type: 'bnode'
      },
      p: { value: 'http://example.com/value' },
      o: { value: 'Part Value' }
    })
  })

  test('should handle triples without blank nodes', () => {
    const triplesWithoutBNodes = sampleTriples.filter((triple) => !triple.bn)
    const result = processTriples(triplesWithoutBNodes)

    expect(Object.keys(result.bNodeMap)).toHaveLength(0)
  })

  test('should identify concepts correctly', () => {
    const result = processTriples(sampleTriples)

    expect(result.conceptURIs).toContain('http://example.com/concept1')
    expect(result.conceptURIs).toContain('http://example.com/concept2')
    expect(result.conceptURIs).not.toContain('http://example.com/nonConcept')
  })

  test('should handle empty input', () => {
    const result = processTriples([])

    expect(result.nodes).toEqual({})
    expect(result.bNodeMap).toEqual({})
    expect(result.conceptURIs).toEqual([])
  })
})
