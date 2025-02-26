import { getNarrowers } from '../getNarrowers'

describe('getNarrowers', () => {
  test('should return an empty array when the URI is not found in the map', () => {
    const map = {}
    const result = getNarrowers('nonexistent-uri', map)
    expect(result).toEqual([])
  })

  test('should correctly transform triples into the expected format', () => {
    const map = {
      'test-uri': [
        {
          prefLabel: { value: 'Test Label' },
          narrower: { value: 'narrower-uri' },
          narrowerPrefLabel: { value: 'Narrower Label' }
        },
        {
          prefLabel: { value: 'Another Label' },
          narrower: { value: 'another-narrower-uri' },
          narrowerPrefLabel: { value: 'Another Narrower Label' }
        }
      ]
    }

    const expected = [
      {
        prefLabel: 'Test Label',
        narrowerPrefLabel: 'Narrower Label',
        uri: 'narrower-uri'
      },
      {
        prefLabel: 'Another Label',
        narrowerPrefLabel: 'Another Narrower Label',
        uri: 'another-narrower-uri'
      }
    ]

    const result = getNarrowers('test-uri', map)
    expect(result).toEqual(expected)
  })

  test('should handle triples with missing properties', () => {
    const map = {
      'test-uri': [
        {
          prefLabel: { value: 'Test Label' },
          narrower: { value: 'narrower-uri' }
          // NarrowerPrefLabel is missing
        }
      ]
    }

    const expected = [
      {
        prefLabel: 'Test Label',
        narrowerPrefLabel: undefined,
        uri: 'narrower-uri'
      }
    ]

    const result = getNarrowers('test-uri', map)
    expect(result).toEqual(expected)
  })
})
