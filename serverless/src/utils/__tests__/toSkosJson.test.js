// Serverless/src/utils/__tests__/toSkosJson.test.js

import {
  describe,
  it,
  expect
} from 'vitest'
import toSkosJson from '../toSkosJson'
import mockInput from '../__mocks__/triples_GREENLANDIAN_input'
import mockOutput from '../__mocks__/json_GREENLANDIAN_output'

describe('toSkosJson', () => {
  const uri = 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'

  test('should convert RDF triples to SKOS JSON representation', () => {
    const result = toSkosJson(uri, mockInput)
    expect(result).toEqual(mockOutput)
  })

  describe('URI handling', () => {
    test('should handle URIs that start with BASE_URI', () => {
      const result = toSkosJson(uri, mockInput)
      expect(result['@rdf:about']).toBe('007cc0a7-cccf-47c9-a55d-af36592055b3')
    })

    test('should handle URIs that do not start with BASE_URI', () => {
      const nonBaseUri = 'http://example.com/concept/123'
      const result = toSkosJson(nonBaseUri, mockInput)
      expect(result['@rdf:about']).toBe(nonBaseUri)
    })
  })

  describe('Literal handling', () => {
    test('should handle literals consistently', () => {
      const literalTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/literal1',
            type: 'uri'
          },
          o: {
            value: 'Literal without lang',
            type: 'literal'
          }
        },
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/literal2',
            type: 'uri'
          },
          o: {
            value: 'Literal with lang',
            type: 'literal',
            'xml:lang': 'en'
          }
        }
      ]
      const result = toSkosJson(uri, literalTriples)
      expect(result['http://example.com/literal1']).toBe('Literal without lang')
      expect(result['http://example.com/literal2']).toEqual({
        _text: 'Literal with lang',
        '@xml:lang': 'en'
      })
    })

    test('should handle literals with language tags', () => {
      const literalWithLangTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#definition',
            type: 'uri'
          },
          o: {
            value: 'A definition with language tag',
            type: 'literal',
            'xml:lang': 'en'
          }
        }
      ]
      const result = toSkosJson(uri, literalWithLangTriples)
      expect(result['skos:definition']).toEqual({
        _text: 'A definition with language tag',
        '@xml:lang': 'en'
      })
    })

    test('should handle literals without language tags', () => {
      const literalWithoutLangTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#note',
            type: 'uri'
          },
          o: {
            value: 'A note without language tag',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, literalWithoutLangTriples)
      expect(result['skos:note']).toBe('A note without language tag')
    })
  })

  describe('Predicate handling', () => {
    test('should handle adding a new predicate to skosConcept', () => {
      const newPredicateTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/newPredicate',
            type: 'uri'
          },
          o: {
            value: 'New predicate value',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, newPredicateTriples)
      expect(result['http://example.com/newPredicate']).toBe('New predicate value')
    })

    test('should handle rdf:type predicates by ignoring them', () => {
      const triplesWithType = [
        ...mockInput,
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            type: 'uri'
          },
          o: {
            value: 'http://www.w3.org/2004/02/skos/core#Concept',
            type: 'uri'
          }
        }
      ]
      const result = toSkosJson(uri, triplesWithType)
      expect(result['rdf:type']).toBeUndefined()
    })

    test('should handle predicates that do not match any prefix', () => {
      const customTriples = [
        ...mockInput,
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/custom#property',
            type: 'uri'
          },
          o: {
            value: 'Custom Value',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, customTriples)
      expect(result['http://example.com/custom#property']).toBe('Custom Value')
    })

    test('should handle multiple values for the same predicate', () => {
      const multiValueTriples = [
        ...mockInput,
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#altLabel',
            type: 'uri'
          },
          o: {
            value: 'Alternative Label',
            type: 'literal'
          }
        },
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#altLabel',
            type: 'uri'
          },
          o: {
            value: 'Another Alternative Label',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, multiValueTriples)
      expect(Array.isArray(result['skos:altLabel'])).toBe(true)
      expect(result['skos:altLabel']).toHaveLength(2)
      expect(result['skos:altLabel']).toContain('Alternative Label')
      expect(result['skos:altLabel']).toContain('Another Alternative Label')
    })

    test('should convert single value to array when adding second value', () => {
      const triplesWithMultipleValues = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/prop',
            type: 'uri'
          },
          o: {
            value: 'Value 1',
            type: 'literal'
          }
        },
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/prop',
            type: 'uri'
          },
          o: {
            value: 'Value 2',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, triplesWithMultipleValues)
      expect(Array.isArray(result['http://example.com/prop'])).toBe(true)
      expect(result['http://example.com/prop']).toEqual(['Value 1', 'Value 2'])
    })
  })

  describe('Blank node handling', () => {
    test('should process blank nodes and their associated triples', () => {
      const bnodeTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/hasPart',
            type: 'uri'
          },
          o: {
            value: '_:b0',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b0',
            type: 'bnode'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#prefLabel',
            type: 'uri'
          },
          o: {
            value: 'Part Label',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, bnodeTriples)
      expect(result['http://example.com/hasPart']).toEqual({
        '@skos:prefLabel': 'Part Label'
      })
    })

    test('should handle blank nodes with no associated triples', () => {
      const triplesWithEmptyBnode = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/emptyBnode',
            type: 'uri'
          },
          o: {
            value: '_:emptyBnode',
            type: 'bnode'
          }
        }
      ]
      const result = toSkosJson(uri, triplesWithEmptyBnode)
      expect(result['http://example.com/emptyBnode']).toEqual({})
    })

    test('should handle blank node with literal value and language tag', () => {
      const triples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/hasPart',
            type: 'uri'
          },
          o: {
            value: '_:b0',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b0',
            type: 'bnode'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#prefLabel',
            type: 'uri'
          },
          o: {
            value: 'Test Label',
            type: 'literal',
            'xml:lang': 'en'
          }
        }
      ]
      const result = toSkosJson(uri, triples)
      expect(result['http://example.com/hasPart']).toEqual({
        '@skos:prefLabel': 'Test Label',
        '@xml:lang': 'en'
      })
    })

    test('should handle blank node with literal value without language tag', () => {
      const triples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/hasPart',
            type: 'uri'
          },
          o: {
            value: '_:b0',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b0',
            type: 'bnode'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#prefLabel',
            type: 'uri'
          },
          o: {
            value: 'Test Label',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, triples)
      expect(result['http://example.com/hasPart']).toEqual({
        '@skos:prefLabel': 'Test Label'
      })
    })

    test('should handle blank node with URI value', () => {
      const triples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/hasRelated',
            type: 'uri'
          },
          o: {
            value: '_:b1',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b1',
            type: 'bnode'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#related',
            type: 'uri'
          },
          o: {
            value: 'http://example.com/concept/123',
            type: 'uri'
          }
        }
      ]
      const result = toSkosJson(uri, triples)
      expect(result['http://example.com/hasRelated']).toEqual({
        '@skos:related': { '@rdf:resource': 'http://example.com/concept/123' }
      })
    })

    test('should handle blank node with multiple properties', () => {
      const triples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/complexPart',
            type: 'uri'
          },
          o: {
            value: '_:b2',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b2',
            type: 'bnode'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#prefLabel',
            type: 'uri'
          },
          o: {
            value: 'Complex Part',
            type: 'literal',
            'xml:lang': 'en'
          }
        },
        {
          s: {
            value: '_:b2',
            type: 'bnode'
          },
          p: {
            value: 'http://example.com/property',
            type: 'uri'
          },
          o: {
            value: 'Property Value',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, triples)
      expect(result['http://example.com/complexPart']).toEqual({
        '@skos:prefLabel': 'Complex Part',
        '@xml:lang': 'en',
        '@http://example.com/property': 'Property Value'
      })
    })

    test('should handle non-standard value types', () => {
      const nonStandardTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/nonStandard',
            type: 'uri'
          },
          o: {
            value: 'Non-standard Value',
            type: 'non-standard'
          }
        }
      ]
      const result = toSkosJson(uri, nonStandardTriples)
      expect(result['http://example.com/nonStandard']).toEqual({ _text: 'Non-standard Value' })
    })

    test('should handle cases where bnodeMap is provided', () => {
      const customBnodeMap = {
        '_:b2': [
          {
            p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
            o: {
              value: 'Custom Bnode Label',
              type: 'literal'
            }
          }
        ]
      }
      const triplesWithCustomBnode = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/customBnode',
            type: 'uri'
          },
          o: {
            value: '_:b2',
            type: 'bnode'
          }
        }
      ]
      const result = toSkosJson(uri, triplesWithCustomBnode, customBnodeMap)
      expect(result['http://example.com/customBnode']).toEqual({
        '@skos:prefLabel': 'Custom Bnode Label'
      })
    })

    test('should handle nested blank nodes', () => {
      const nestedBnodeTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/hasPart',
            type: 'uri'
          },
          o: {
            value: '_:b0',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b0',
            type: 'bnode'
          },
          p: {
            value: 'http://example.com/hasSubPart',
            type: 'uri'
          },
          o: {
            value: '_:b1',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b1',
            type: 'bnode'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#prefLabel',
            type: 'uri'
          },
          o: {
            value: 'Nested Part',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, nestedBnodeTriples)
      expect(result['http://example.com/hasPart']).toEqual({
        '@http://example.com/hasSubPart': {
          '@skos:prefLabel': 'Nested Part'
        }
      })
    })

    test('should handle blank nodes with complex object values', () => {
      const complexObjectBnodeTriples = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/hasPart',
            type: 'uri'
          },
          o: {
            value: '_:b0',
            type: 'bnode'
          }
        },
        {
          s: {
            value: '_:b0',
            type: 'bnode'
          },
          p: {
            value: 'http://example.com/complexProperty',
            type: 'uri'
          },
          o: {
            value: 'complexValue',
            type: 'complex'
          }
        }
      ]

      const customBnodeMap = {
        '_:b0': [
          {
            p: { value: 'http://example.com/complexProperty' },
            o: {
              value: 'complexValue',
              type: 'complex'
            }
          }
        ]
      }

      const result = toSkosJson(uri, complexObjectBnodeTriples, customBnodeMap)

      expect(result['http://example.com/hasPart']).toEqual({
        '@http://example.com/complexProperty': 'complexValue'
      })
    })
  })

  describe('Edge cases', () => {
    test('should handle empty triples array', () => {
      const result = toSkosJson(uri, [])
      expect(result).toEqual({ '@rdf:about': '007cc0a7-cccf-47c9-a55d-af36592055b3' })
    })

    test('should handle triples not related to the given URI', () => {
      const unrelatedTriples = [
        {
          s: {
            value: 'http://example.com/other',
            type: 'uri'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#prefLabel',
            type: 'uri'
          },
          o: {
            value: 'Unrelated Label',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, unrelatedTriples)
      expect(result).toEqual({ '@rdf:about': '007cc0a7-cccf-47c9-a55d-af36592055b3' })
    })

    test('should handle URIs with different prefixes', () => {
      const triplesWithDifferentPrefixes = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://www.w3.org/2004/02/skos/core#related',
            type: 'uri'
          },
          o: {
            value: 'https://example.com/concept/123',
            type: 'uri'
          }
        },
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'https://gcmd.earthdata.nasa.gov/kms#someProperty',
            type: 'uri'
          },
          o: {
            value: 'Some Value',
            type: 'literal'
          }
        }
      ]
      const result = toSkosJson(uri, triplesWithDifferentPrefixes)
      expect(result['skos:related']).toEqual({ '@rdf:resource': 'https://example.com/concept/123' })
      expect(result['gcmd:someProperty']).toBe('Some Value')
    })

    test('should handle unknown object types', () => {
      const triplesWithUnknownType = [
        {
          s: {
            value: uri,
            type: 'uri'
          },
          p: {
            value: 'http://example.com/unknown',
            type: 'uri'
          },
          o: {
            value: 'Unknown value',
            type: 'unknown'
          }
        }
      ]
      const result = toSkosJson(uri, triplesWithUnknownType)
      expect(result['http://example.com/unknown']).toEqual({ _text: 'Unknown value' })
    })
  })
})
