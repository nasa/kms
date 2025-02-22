// FetchNarrowers.test.js
import { describe, expect } from 'vitest'
import fetchNarrowers from '../fetchNarrowers'

describe('fetchNarrowers', () => {
  test('should return an empty array when the URI is not found in the map', () => {
    const map = {}
    const result = fetchNarrowers('nonexistentURI', map)
    expect(result).toEqual([])
  })

  test('should correctly transform the triples for a given URI', () => {
    const map = {
      testURI: [
        {
          prefLabel: { value: 'Test Concept' },
          narrower: { value: 'narrower1' },
          narrowerPrefLabel: { value: 'Narrower 1' }
        },
        {
          prefLabel: { value: 'Test Concept' },
          narrower: { value: 'narrower2' },
          narrowerPrefLabel: { value: 'Narrower 2' }
        }
      ]
    }

    const expected = [
      {
        prefLabel: 'Test Concept',
        narrowerPrefLabel: 'Narrower 1',
        uri: 'narrower1'
      },
      {
        prefLabel: 'Test Concept',
        narrowerPrefLabel: 'Narrower 2',
        uri: 'narrower2'
      }
    ]

    const result = fetchNarrowers('testURI', map)
    expect(result).toEqual(expected)
  })

  test('should handle a single triple for a given URI', () => {
    const map = {
      testURI: [
        {
          prefLabel: { value: 'Test Concept' },
          narrower: { value: 'narrower1' },
          narrowerPrefLabel: { value: 'Narrower 1' }
        }
      ]
    }

    const expected = [
      {
        prefLabel: 'Test Concept',
        narrowerPrefLabel: 'Narrower 1',
        uri: 'narrower1'
      }
    ]

    const result = fetchNarrowers('testURI', map)
    expect(result).toEqual(expected)
  })

  test('should ignore additional properties in the triple', () => {
    const map = {
      testURI: [
        {
          prefLabel: { value: 'Test Concept' },
          narrower: { value: 'narrower1' },
          narrowerPrefLabel: { value: 'Narrower 1' },
          additionalProp: { value: 'Should be ignored' }
        }
      ]
    }

    const expected = [
      {
        prefLabel: 'Test Concept',
        narrowerPrefLabel: 'Narrower 1',
        uri: 'narrower1'
      }
    ]

    const result = fetchNarrowers('testURI', map)
    expect(result).toEqual(expected)
  })
})
