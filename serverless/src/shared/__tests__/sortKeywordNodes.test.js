import { describe, expect } from 'vitest'

import { sortKeywordNodes } from '../sortKeywordNodes'

describe('sortKeywordNodes', () => {
  describe('When sorting root level nodes', () => {
    test('should not sort root level nodes', () => {
      const nodes = [
        { title: 'C' },
        { title: 'A' },
        { title: 'B' }
      ]
      const result = sortKeywordNodes(nodes)
      expect(result).toEqual([
        { title: 'C' },
        { title: 'A' },
        { title: 'B' }
      ])
    })

    test('should sort non-root level nodes', () => {
      const nodes = [
        { title: 'C' },
        { title: 'A' },
        { title: 'B' }
      ]
      const result = sortKeywordNodes(nodes, false)
      expect(result).toEqual([
        { title: 'A' },
        { title: 'B' },
        { title: 'C' }
      ])
    })
  })

  describe('When sorting nested structures', () => {
    test('should sort nested children', () => {
      const nodes = [
        {
          title: 'Parent B',
          children: [
            { title: 'Child B2' },
            { title: 'Child B1' }
          ]
        },
        {
          title: 'Parent A',
          children: [
            { title: 'Child A2' },
            { title: 'Child A1' }
          ]
        }
      ]
      const result = sortKeywordNodes(nodes)
      expect(result).toEqual([
        {
          title: 'Parent B',
          children: [
            { title: 'Child B1' },
            { title: 'Child B2' }
          ]
        },
        {
          title: 'Parent A',
          children: [
            { title: 'Child A1' },
            { title: 'Child A2' }
          ]
        }
      ])
    })

    test('should handle deeply nested structures', () => {
      const nodes = [
        {
          title: 'Root A',
          children: [
            {
              title: 'Child B',
              children: [
                { title: 'Grandchild C' },
                { title: 'Grandchild A' },
                { title: 'Grandchild B' }
              ]
            },
            {
              title: 'Child A',
              children: [
                { title: 'Grandchild E' },
                { title: 'Grandchild D' }
              ]
            }
          ]
        }
      ]
      const result = sortKeywordNodes(nodes)
      expect(result).toEqual([
        {
          title: 'Root A',
          children: [
            {
              title: 'Child A',
              children: [
                { title: 'Grandchild D' },
                { title: 'Grandchild E' }
              ]
            },
            {
              title: 'Child B',
              children: [
                { title: 'Grandchild A' },
                { title: 'Grandchild B' },
                { title: 'Grandchild C' }
              ]
            }
          ]
        }
      ])
    })
  })

  describe('When handling special cases', () => {
    test('should handle nodes without children', () => {
      const nodes = [
        { title: 'B' },
        { title: 'A' },
        { title: 'C' }
      ]
      const result = sortKeywordNodes(nodes, false)
      expect(result).toEqual([
        { title: 'A' },
        { title: 'B' },
        { title: 'C' }
      ])
    })

    test('should return the input if it is not an array', () => {
      const node = { title: 'Single Node' }
      const result = sortKeywordNodes(node)
      expect(result).toEqual(node)
    })

    test('should handle empty arrays', () => {
      const nodes = []
      const result = sortKeywordNodes(nodes)
      expect(result).toEqual([])
    })

    test('should handle mixed node types', () => {
      const nodes = [
        {
          title: 'Parent B',
          children: [
            { title: 'Child B2' },
            { title: 'Child B1' }
          ]
        },
        { title: 'Single Node C' },
        {
          title: 'Parent A',
          children: [
            { title: 'Child A2' },
            { title: 'Child A1' }
          ]
        },
        { title: 'Single Node B' },
        { title: 'Single Node A' }
      ]
      const result = sortKeywordNodes(nodes)
      expect(result).toEqual([
        {
          title: 'Parent B',
          children: [
            { title: 'Child B1' },
            { title: 'Child B2' }
          ]
        },
        { title: 'Single Node C' },
        {
          title: 'Parent A',
          children: [
            { title: 'Child A1' },
            { title: 'Child A2' }
          ]
        },
        { title: 'Single Node B' },
        { title: 'Single Node A' }
      ])
    })

    test('should handle nodes with empty children arrays', () => {
      const nodes = [
        {
          title: 'Node B',
          children: []
        },
        {
          title: 'Node A',
          children: []
        },
        {
          title: 'Node C',
          children: []
        }
      ]
      const result = sortKeywordNodes(nodes, false)
      expect(result).toEqual([
        {
          title: 'Node A',
          children: []
        },
        {
          title: 'Node B',
          children: []
        },
        {
          title: 'Node C',
          children: []
        }
      ])
    })

    test('should maintain original order for nodes with same title', () => {
      const nodes = [
        {
          title: 'Same',
          id: 1
        },
        {
          title: 'Same',
          id: 2
        },
        {
          title: 'Same',
          id: 3
        }
      ]
      const result = sortKeywordNodes(nodes, false)
      expect(result).toEqual([
        {
          title: 'Same',
          id: 1
        },
        {
          title: 'Same',
          id: 2
        },
        {
          title: 'Same',
          id: 3
        }
      ])
    })
  })
})
