import {
  describe,
  expect,
  test
} from 'vitest'

import { getMaxLengthOfSubArray } from '../getMaxLengthOfSubArray'

describe('getMaxLengthOfSubArray', () => {
  describe('when successful', () => {
    test('should return the correct length for a regular 2D array', () => {
      const regularArray = [[1, 2, 3], [4, 5], [6, 7, 8, 9]]
      expect(getMaxLengthOfSubArray(regularArray)).toBe(4)
    })

    test('should handle arrays with mixed types', () => {
      const mixedArray = [[1, 2], 'string', [3, 4, 5]]
      expect(getMaxLengthOfSubArray(mixedArray)).toBe(3)
    })

    test('should handle arrays with empty sub-arrays', () => {
      const emptySubArrays = [[], [], [1, 2]]
      expect(getMaxLengthOfSubArray(emptySubArrays)).toBe(2)
    })

    test('should handle arrays with nested arrays', () => {
      const nestedArray = [[1, 2], [3, [4, 5]], [6, 7, 8]]
      expect(getMaxLengthOfSubArray(nestedArray)).toBe(3)
    })

    test('should handle arrays with only one sub-array', () => {
      const singleSubArray = [[1, 2, 3, 4, 5]]
      expect(getMaxLengthOfSubArray(singleSubArray)).toBe(5)
    })

    test('should handle arrays with all empty sub-arrays', () => {
      const allEmptySubArrays = [[], [], []]
      expect(getMaxLengthOfSubArray(allEmptySubArrays)).toBe(0)
    })
  })

  describe('when unsuccessful', () => {
    test('should return 0 for an empty array', () => {
      const emptyArray = []
      expect(getMaxLengthOfSubArray(emptyArray)).toBe(0)
    })

    test('should return 0 for non-array input', () => {
      expect(getMaxLengthOfSubArray('not an array')).toBe(0)
      expect(getMaxLengthOfSubArray(123)).toBe(0)
      expect(getMaxLengthOfSubArray(null)).toBe(0)
      expect(getMaxLengthOfSubArray(undefined)).toBe(0)
    })
  })
})
