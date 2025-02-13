import { describe, expect } from 'vitest'
import processTriples from '../processTriples'

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
      o: { value: '_:bnode1' }
    },
    {
      s: {
        value: '_:bnode1',
        type: 'bnode'
      },
      p: { value: 'http://example.com/name' },
      o: { value: 'Part Name' }
    },
    {
      s: {
        value: '_:bnode1',
        type: 'bnode'
      },
      p: { value: 'http://example.com/value' },
      o: { value: 'Part Value' }
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

  describe('when SKOS concepts are present in the triples', () => {
    test('should pull out the concept identifiers of each SKOS concept', () => {
      const result = processTriples(sampleTriples)

      expect(result.conceptURIs).toBeDefined()
      expect(result.conceptURIs).toHaveLength(2)
      expect(result.conceptURIs).toContain('http://example.com/concept1')
      expect(result.conceptURIs).toContain('http://example.com/concept2')
      expect(result.conceptURIs).not.toContain('http://example.com/nonConcept')
    })

    test('should organize each concept and their associated triples', () => {
      const result = processTriples(sampleTriples)

      expect(result.nodes).toBeDefined()
      expect(result.nodes['http://example.com/concept1']).toHaveLength(2)
      expect(result.nodes['http://example.com/concept2']).toHaveLength(2)
      expect(result.nodes['http://example.com/nonConcept']).toHaveLength(1)
    })

    test('should create a map of blank nodes and their associated triples', () => {
      const result = processTriples(sampleTriples)

      expect(result.bNodeMap).toBeDefined()
      expect(result.bNodeMap['_:bnode1']).toBeDefined()
      expect(result.bNodeMap['_:bnode1']).toHaveLength(2)
    })
  })
})
