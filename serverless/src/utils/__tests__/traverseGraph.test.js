// TraverseGraph.test.js
import {
  describe,
  it,
  expect,
  vi
} from 'vitest'
import traverseGraph from '../traverseGraph'

// Import the mocked function after mocking
import fetchNarrowers from '../fetchNarrowers'

// Mock the fetchNarrowers function
vi.mock('../fetchNarrowers', () => ({
  default: vi.fn()
}))

describe('traverseGraph', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  it('should traverse the graph and collect paths', async () => {
    // Mock data
    const scheme = 'testScheme'
    const initialNode = {
      narrowerPrefLabel: 'Root',
      uri: 'root-uri'
    }
    const map = new Map()

    // Mock fetchNarrowers to return different values for different URIs
    fetchNarrowers
      .mockReturnValueOnce([
        {
          narrowerPrefLabel: 'Child1',
          uri: 'child1-uri'
        },
        {
          narrowerPrefLabel: 'Child2',
          uri: 'child2-uri'
        }
      ])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          narrowerPrefLabel: 'Grandchild',
          uri: 'grandchild-uri'
        }
      ])
      .mockReturnValueOnce([])

    const paths = []
    await traverseGraph(scheme, initialNode, map, [], paths)

    // Assertions
    expect(paths).toHaveLength(4)
    expect(paths).toEqual([
      ['Root', 'Child1'],
      ['Root', 'Child2', 'Grandchild'],
      ['Root', 'Child2'],
      ['Root']
    ])

    console.log('paths=', paths)

    // Verify that fetchNarrowers was called with the correct arguments
    expect(fetchNarrowers).toHaveBeenCalledWith('root-uri', map)
    expect(fetchNarrowers).toHaveBeenCalledWith('child1-uri', map)
    expect(fetchNarrowers).toHaveBeenCalledWith('child2-uri', map)
    expect(fetchNarrowers).toHaveBeenCalledWith('grandchild-uri', map)
  })

  it('should handle empty narrowers', async () => {
    const scheme = 'testScheme'
    const initialNode = {
      narrowerPrefLabel: 'Root',
      uri: 'root-uri'
    }
    const map = new Map()

    fetchNarrowers.mockReturnValue([])

    const paths = []
    await traverseGraph(scheme, initialNode, map, [], paths)

    expect(paths).toHaveLength(1)
    expect(paths).toEqual([['Root']])

    expect(fetchNarrowers).toHaveBeenCalledWith('root-uri', map)
  })
})
