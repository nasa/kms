import {
  describe,
  expect,
  it,
  vi
} from 'vitest'

import formatCsvPath from '../formatCsvPath'
import getCsvLongNameFlag from '../getCsvLongNameFlag'
import getCsvProviderUrlFlag from '../getCsvProviderUrlFlag'
import getNarrowers from '../getNarrowers'
import traverseGraph from '../traverseGraph'

// Mock the imported functions
vi.mock('../getNarrowers')
vi.mock('../formatCsvPath')
vi.mock('../getCsvLongNameFlag')
vi.mock('../getCsvProviderUrlFlag')

describe('traverseGraph', () => {
  test('should traverse the graph and return paths', async () => {
    const csvHeadersCount = 3
    const providerUrlsMap = {
      'http://example.com/1': ['http://provider.com/1'],
      'http://example.com/2': ['http://provider.com/2']
    }
    const longNamesMap = {
      'http://example.com/1': ['Long Name 1'],
      'http://example.com/2': ['Long Name 2']
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

    getCsvLongNameFlag.mockReturnValue(true)
    getCsvProviderUrlFlag.mockReturnValue(true)

    const paths = []
    await traverseGraph(csvHeadersCount, providerUrlsMap, longNamesMap, scheme, rootNode, map, [], paths)

    expect(paths).toHaveLength(2)
    expect(paths[0]).toEqual(['Child1', 'Long Name 1', 'http://provider.com/1', '1'])
    expect(paths[1]).toEqual(['Child2', 'Long Name 2', 'http://provider.com/2', '2'])
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

    getCsvLongNameFlag.mockReturnValue(true)
    getCsvProviderUrlFlag.mockReturnValue(true)

    const paths = []
    await traverseGraph(csvHeadersCount, providerUrlsMap, longNamesMap, scheme, rootNode, map, [], paths)

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
    await traverseGraph(csvHeadersCount, providerUrlsMap, longNamesMap, scheme, rootNode, map, [], paths)

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

    getCsvLongNameFlag.mockReturnValue(false)
    getCsvProviderUrlFlag.mockReturnValue(false)

    formatCsvPath.mockImplementation((scheme, csvHeadersCount, path, isLeaf) => {
      // Don't modify the path in this mock implementation
    })

    const paths = []
    await traverseGraph(csvHeadersCount, providerUrlsMap, longNamesMap, scheme, rootNode, map, [], paths)

    expect(formatCsvPath).toHaveBeenCalledWith(scheme, csvHeadersCount, ['Child', 'child'], true)
  })
})
