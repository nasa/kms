import {
  describe,
  expect,
  vi
} from 'vitest'

import { buildKeywordsTree } from '../buildKeywordsTree'
import { getNarrowers } from '../getNarrowers'

// Mock the getNarrowers function
vi.mock('../getNarrowers')

describe('buildKeywordsTree', () => {
  describe('When successful', () => {
    test('should build a tree from a root node', async () => {
      const rootNode = {
        narrowerPrefLabel: 'Root',
        uri: 'http://example.com/root'
      }
      const narrowersMap = new Map()

      getNarrowers.mockResolvedValue([])

      const result = await buildKeywordsTree(rootNode, narrowersMap)

      expect(result).toEqual({
        key: 'root',
        title: 'Root',
        children: []
      })
    })

    test('should handle nested nodes', async () => {
      const rootNode = {
        narrowerPrefLabel: 'Root',
        uri: 'http://example.com/root'
      }
      const childNode = {
        narrowerPrefLabel: 'Child',
        uri: 'http://example.com/child'
      }
      const narrowersMap = new Map()

      getNarrowers.mockResolvedValueOnce([childNode])
      getNarrowers.mockResolvedValueOnce([])

      const result = await buildKeywordsTree(rootNode, narrowersMap)

      expect(result).toEqual({
        key: 'root',
        title: 'Root',
        children: [
          {
            key: 'child',
            title: 'Child',
            children: []
          }
        ]
      })
    })
  })

  describe('When unsuccessful', () => {
    test('should return null for already processed nodes', async () => {
      const rootNode = {
        narrowerPrefLabel: 'Root',
        uri: 'http://example.com/root'
      }
      const narrowersMap = new Map()
      const processedNodes = new Set(['http://example.com/root'])

      const result = await buildKeywordsTree(rootNode, narrowersMap, processedNodes)

      expect(result).toBeNull()
    })
  })
})
