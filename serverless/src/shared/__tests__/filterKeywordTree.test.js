import {
  describe,
  expect,
  test
} from 'vitest'

import { filterKeywordTree, matchesFilter } from '../filterKeywordTree'

describe('matchesFilter', () => {
  describe('When successful', () => {
    test('should return true when filter is empty', () => {
      expect(matchesFilter('Hello World', '')).toBe(true)
    })

    test('should return true when title contains filter (case-insensitive)', () => {
      expect(matchesFilter('Hello World', 'world')).toBe(true)
      expect(matchesFilter('Hello World', 'HELLO')).toBe(true)
    })
  })

  describe('When unsuccessful', () => {
    test('should return false when title does not contain filter', () => {
      expect(matchesFilter('Hello World', 'foo')).toBe(false)
    })
  })
})

describe('filterKeywordTree', () => {
  const tree = {
    title: 'Root',
    children: [
      {
        title: 'Child 1',
        children: []
      },
      {
        title: 'Child 2',
        children: [
          {
            title: 'Grandchild',
            children: []
          }
        ]
      }
    ]
  }

  describe('When successful', () => {
    test('should return the full tree when filter is empty', () => {
      expect(filterKeywordTree(tree, '')).toEqual(tree)
    })

    test('should filter tree based on node titles', () => {
      const expected = {
        title: 'Root',
        children: [
          {
            title: 'Child 1',
            children: []
          },
          {
            title: 'Child 2',
            children: [
              {
                title: 'Grandchild',
                children: []
              }
            ]
          }
        ]
      }
      expect(filterKeywordTree(tree, 'child')).toEqual(expected)
    })

    test('should filter tree and include parent nodes of matches', () => {
      const expected = {
        title: 'Root',
        children: [
          {
            title: 'Child 2',
            children: [
              {
                title: 'Grandchild',
                children: []
              }
            ]
          }
        ]
      }
      expect(filterKeywordTree(tree, 'grandchild')).toEqual(expected)
    })

    test('should handle nodes without children', () => {
      const treeWithoutChildren = {
        title: 'Root'
        // Note: no children property
      }

      const expected = {
        title: 'Root',
        children: [] // The function adds an empty children array
      }

      expect(filterKeywordTree(treeWithoutChildren, 'Root')).toEqual(expected)
    })
  })

  describe('When unsuccessful', () => {
    test('should return null for null input', () => {
      expect(filterKeywordTree(null, 'test')).toBeNull()
    })

    test('should return null when no nodes match the filter', () => {
      expect(filterKeywordTree(tree, 'nonexistent')).toBeNull()
    })
  })
})
