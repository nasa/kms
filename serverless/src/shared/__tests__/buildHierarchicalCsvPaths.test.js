import {
  describe,
  expect,
  vi
} from 'vitest'

import { buildHierarchicalCsvPaths } from '../buildHierarchicalCsvPaths'
import { formatCsvPath } from '../formatCsvPath'
import { getNarrowers } from '../getNarrowers'
import { isCsvLongNameFlag } from '../isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from '../isCsvProviderUrlFlag'

// Mock the imported functions
vi.mock('../getNarrowers')
vi.mock('../formatCsvPath')
vi.mock('../isCsvLongNameFlag')
vi.mock('../isCsvProviderUrlFlag')

describe('buildHierarchicalCsvPaths', () => {
  test('should traverse the graph and return paths', async () => {
    const csvHeadersCount = 3
    const providerUrlsMap = {
      'http://example.com/1': ['http://provider.com/1'],
      'http://example.com/2': ['http://provider.com/2']
    }
    const longNamesMap = {
      'http://example.com/1': 'Long Name 1',
      'http://example.com/2': 'Long Name 2'
    }
    const scheme = 'testScheme'
    const rootNode = {
      narrowerPrefLabel: 'Root',
      uri: 'http://example.com/root'
    }
    const map = new Map()

    getNarrowers.mockReturnValueOnce([
      {
        narrowerPrefLabel: 'Child1',
        uri: 'http://example.com/1'
      },
      {
        narrowerPrefLabel: 'Child2',
        uri: 'http://example.com/2'
      }
    ])

    getNarrowers.mockReturnValue([])

    isCsvLongNameFlag.mockReturnValue(true)
    isCsvProviderUrlFlag.mockReturnValue(true)

    const paths = []
    await buildHierarchicalCsvPaths({
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n: rootNode,
      map,
      path: [],
      paths
    })

    expect(paths).toHaveLength(2)
    expect(paths[0]).toEqual(['Child1', 'Long Name 1', 'http://provider.com/1', '1'])
    expect(paths[1]).toEqual(['Child2', 'Long Name 2', 'http://provider.com/2', '2'])
  })

  test('should recursively process narrower concepts', async () => {
    const csvHeadersCount = 3
    const providerUrlsMap = {}
    const longNamesMap = {}
    const scheme = 'testScheme'
    const rootNode = {
      narrowerPrefLabel: 'Root',
      uri: 'http://example.com/root'
    }
    const map = new Map()

    // Mock a three-level hierarchy
    getNarrowers.mockImplementation((uri) => {
      if (uri === 'http://example.com/root') {
        return [
          {
            narrowerPrefLabel: 'Child1',
            uri: 'http://example.com/1'
          },
          {
            narrowerPrefLabel: 'Child2',
            uri: 'http://example.com/2'
          }
        ]
      }

      if (uri === 'http://example.com/1') {
        return [
          {
            narrowerPrefLabel: 'Grandchild1',
            uri: 'http://example.com/3'
          }
        ]
      }

      return []
    })

    isCsvLongNameFlag.mockReturnValue(false)
    isCsvProviderUrlFlag.mockReturnValue(false)

    const paths = []
    await buildHierarchicalCsvPaths({
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n: rootNode,
      map,
      path: [],
      paths
    })

    expect(paths).toHaveLength(3)
    expect(paths[0]).toEqual(['Child1', 'Grandchild1', '3'])
    expect(paths[1]).toEqual(['Child1', '1'])
    expect(paths[2]).toEqual(['Child2', '2'])

    // Verify that getNarrowers was called the correct number of times
    expect(getNarrowers).toHaveBeenCalledTimes(7)
    expect(getNarrowers).toHaveBeenNthCalledWith(1, 'http://example.com/root', map)
    expect(getNarrowers).toHaveBeenNthCalledWith(2, 'http://example.com/1', map)
    expect(getNarrowers).toHaveBeenNthCalledWith(3, 'http://example.com/2', map)
    expect(getNarrowers).toHaveBeenNthCalledWith(4, 'http://example.com/root', map)
    expect(getNarrowers).toHaveBeenNthCalledWith(5, 'http://example.com/1', map)
    expect(getNarrowers).toHaveBeenNthCalledWith(6, 'http://example.com/3', map)
    expect(getNarrowers).toHaveBeenNthCalledWith(7, 'http://example.com/2', map)
  })

  test('should not add paths with only one node', async () => {
    const csvHeadersCount = 3
    const providerUrlsMap = {}
    const longNamesMap = {}
    const scheme = 'testScheme'
    const rootNode = {
      narrowerPrefLabel: 'Root',
      uri: 'http://example.com/root'
    }
    const map = new Map()

    // Mock getNarrowers to return an empty array, simulating a root node with no children
    getNarrowers.mockReturnValue([])

    isCsvLongNameFlag.mockReturnValue(false)
    isCsvProviderUrlFlag.mockReturnValue(false)

    // Clear all mocks before this test
    vi.clearAllMocks()

    const paths = []
    await buildHierarchicalCsvPaths({
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n: rootNode,
      map,
      paths
    })

    // Verify that no paths were added
    expect(paths).toHaveLength(0)

    // Verify that getNarrowers was called
    expect(getNarrowers).toHaveBeenCalledWith('http://example.com/root', map)

    // Log the calls to formatCsvPath for debugging
    console.log('formatCsvPath calls:', formatCsvPath.mock.calls)

    // Verify that formatCsvPath was not called with the root node's path
    expect(formatCsvPath).not.toHaveBeenCalledWith(
      scheme,
      csvHeadersCount,
      ['Root'],
      true
    )
  })

  test('should handle nodes without long names or provider URLs', async () => {
    const csvHeadersCount = 3
    const providerUrlsMap = {}
    const longNamesMap = {}
    const scheme = 'testScheme'
    const rootNode = {
      narrowerPrefLabel: 'Root',
      uri: 'http://example.com/root'
    }
    const map = new Map()

    getNarrowers.mockReturnValueOnce([
      {
        narrowerPrefLabel: 'Child',
        uri: 'http://example.com/child'
      }
    ])

    getNarrowers.mockReturnValue([])

    isCsvLongNameFlag.mockReturnValue(true)
    isCsvProviderUrlFlag.mockReturnValue(true)

    const paths = []
    await buildHierarchicalCsvPaths({
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n: rootNode,
      map,
      path: [],
      paths
    })

    expect(paths).toHaveLength(1)
    expect(paths[0]).toEqual(['Child', ' ', ' ', 'child'])
  })

  test('should not include paths with only one node', async () => {
    const csvHeadersCount = 3
    const providerUrlsMap = {}
    const longNamesMap = {}
    const scheme = 'testScheme'
    const rootNode = {
      narrowerPrefLabel: 'Root',
      uri: 'http://example.com/root'
    }
    const map = new Map()

    getNarrowers.mockReturnValue([])

    const paths = []
    await buildHierarchicalCsvPaths({
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n: rootNode,
      map,
      path: [],
      paths
    })

    expect(paths).toHaveLength(0)
  })

  test('should format CSV path for leaf nodes', async () => {
    const csvHeadersCount = 3
    const providerUrlsMap = {}
    const longNamesMap = {}
    const scheme = 'testScheme'
    const rootNode = {
      narrowerPrefLabel: 'Root',
      uri: 'http://example.com/root'
    }
    const map = new Map()

    getNarrowers.mockReturnValueOnce([
      {
        narrowerPrefLabel: 'Child',
        uri: 'http://example.com/child'
      }
    ])

    getNarrowers.mockReturnValue([])

    isCsvLongNameFlag.mockReturnValue(false)
    isCsvProviderUrlFlag.mockReturnValue(false)

    const paths = []
    await buildHierarchicalCsvPaths({
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n: rootNode,
      map,
      path: [],
      paths
    })

    expect(formatCsvPath).toHaveBeenCalledWith(scheme, csvHeadersCount, ['Child', 'child'], true)
  })
})
