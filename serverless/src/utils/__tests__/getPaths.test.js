// Serverless/src/utils/__tests__/getPaths.test.js

import {
  describe,
  it,
  expect,
  vi
} from 'vitest'
import getPaths from '../getPaths'
import getRootConcept from '../getRootConcept'
import getNarrowersMap from '../getNarrowersMap'
import traverseGraph from '../traverseGraph'

// Mock the imported functions
vi.mock('../getRootConcept')
vi.mock('../getNarrowersMap')
vi.mock('../traverseGraph')

describe('getPaths', () => {
  it('should return reversed keywords array', async () => {
    // Mock the root concept
    const mockRoot = {
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    }
    getRootConcept.mockResolvedValue(mockRoot)

    // Mock the narrowers map
    const mockMap = new Map()
    getNarrowersMap.mockResolvedValue(mockMap)

    // Mock the traverseGraph function
    const mockKeywords = ['Keyword1', 'Keyword2', 'Keyword3']
    traverseGraph.mockImplementation((scheme, node, map, path, keywords) => {
      keywords.push(...mockKeywords)
    })

    // Call the getPaths function
    const scheme = 'TestScheme'
    const result = await getPaths(scheme)

    // Assertions
    expect(getRootConcept).toHaveBeenCalledWith(scheme)
    expect(getNarrowersMap).toHaveBeenCalledWith(scheme)
    expect(traverseGraph).toHaveBeenCalledWith(
      scheme,
      {
        prefLabel: 'Root',
        narrowerPrefLabel: 'Root',
        uri: 'http://example.com/root'
      },
      mockMap,
      [],
      expect.any(Array)
    )

    expect(result).toEqual(['Keyword3', 'Keyword2', 'Keyword1'])
  })

  it('should handle empty keywords array', async () => {
    // Mock the root concept
    const mockRoot = {
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    }
    getRootConcept.mockResolvedValue(mockRoot)

    // Mock the narrowers map
    const mockMap = new Map()
    getNarrowersMap.mockResolvedValue(mockMap)

    // Mock the traverseGraph function to not add any keywords
    traverseGraph.mockImplementation(() => {})

    // Call the getPaths function
    const scheme = 'TestScheme'
    const result = await getPaths(scheme)

    // Assertions
    expect(result).toEqual([])
  })

  // Add more test cases as needed
})
