import { describe, expect } from 'vitest'

import { cleanupJsonObject } from '../cleanupJsonObject'

describe('cleanupJsonObject', () => {
  test('should return non-object values as is', () => {
    expect(cleanupJsonObject('string')).toBe('string')
    expect(cleanupJsonObject(123)).toBe(123)
    expect(cleanupJsonObject(true)).toBe(true)
    expect(cleanupJsonObject(null)).toBe(null)
    expect(cleanupJsonObject(undefined)).toBe(undefined)
  })

  test('should remove empty strings from objects', () => {
    const input = {
      a: 'hello',
      b: '',
      c: 'world'
    }
    const expected = {
      a: 'hello',
      c: 'world'
    }
    expect(cleanupJsonObject(input)).toEqual(expected)
  })

  test('should remove null values from objects', () => {
    const input = {
      a: 'hello',
      b: null,
      c: 'world'
    }
    const expected = {
      a: 'hello',
      c: 'world'
    }
    expect(cleanupJsonObject(input)).toEqual(expected)
  })

  test('should clean up nested objects', () => {
    const input = {
      a: 'hello',
      b: {
        c: '',
        d: null,
        e: 'world'
      }
    }
    const expected = {
      a: 'hello',
      b: {
        e: 'world'
      }
    }
    expect(cleanupJsonObject(input)).toEqual(expected)
  })

  test('should remove empty objects', () => {
    const input = {
      a: 'hello',
      b: {},
      c: 'world'
    }
    const expected = {
      a: 'hello',
      c: 'world'
    }
    expect(cleanupJsonObject(input)).toEqual(expected)
  })

  test('should handle complex nested structures', () => {
    const input = {
      a: 'hello',
      b: [
        {
          c: '',
          d: 'test'
        },
        {
          e: null,
          f: {}
        },
        'world'
      ],
      g: {
        h: '',
        i: { j: null }
      }
    }
    const expected = {
      a: 'hello',
      b: [
        { d: 'test' },
        'world'
      ]
    }
    expect(cleanupJsonObject(input)).toEqual(expected)
  })
})
