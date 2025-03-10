import {
  describe,
  expect,
  test
} from 'vitest'

import { filterScienceKeywordsTree } from '../filterScienceKeywordsTree'

describe('filterScienceKeywordsTree', () => {
  const sampleTree = {
    key: '1eb0ea0a-312c-4d74-8d42-6f1ad758f999',
    title: 'Science Keywords',
    children: [
      {
        key: '894f9116-ae3c-40b6-981d-5113de961710',
        title: 'EARTH SCIENCE SERVICES',
        children: []
      },
      {
        key: '894f9116-ds34-40b6-981d-5113de961712',
        title: 'EARTH SCIENCE',
        children: []
      }
    ]
  }

  describe('When successful', () => {
    test('should return the correct child when a matching title is provided', () => {
      const result = filterScienceKeywordsTree(sampleTree, 'EARTH SCIENCE')
      expect(result).toEqual({
        key: '894f9116-ds34-40b6-981d-5113de961712',
        title: 'Earth Science',
        children: []
      })
    })

    test('should be case-insensitive when matching titles', () => {
      const result = filterScienceKeywordsTree(sampleTree, 'earth science')
      expect(result).toEqual({
        key: '894f9116-ds34-40b6-981d-5113de961712',
        title: 'Earth Science',
        children: []
      })
    })

    test('should properly capitalize the title in the result', () => {
      const result = filterScienceKeywordsTree(sampleTree, 'EARTH SCIENCE SERVICES')
      expect(result.title).toBe('Earth Science Services')
    })
  })

  describe('When unsuccessful', () => {
    test('should return null when no matching title is found', () => {
      const result = filterScienceKeywordsTree(sampleTree, 'SPACE SCIENCE')
      expect(result).toBeNull()
    })

    test('should return null when the input tree has no children', () => {
      const emptyTree = {
        key: '123',
        title: 'Empty',
        children: []
      }
      const result = filterScienceKeywordsTree(emptyTree, 'ANY TITLE')
      expect(result).toBeNull()
    })

    test('should return null when the input tree has undefined children', () => {
      const treeWithoutChildren = {
        key: '123',
        title: 'No Children'
      }
      const result = filterScienceKeywordsTree(treeWithoutChildren, 'ANY TITLE')
      expect(result).toBeNull()
    })
  })
})
