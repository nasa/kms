import {
  describe,
  expect,
  test
} from 'vitest'

import { hasMeaningfulKeywordObject } from '../hasMeaningfulKeywordObject'

describe('hasMeaningfulKeywordObject', () => {
  test('treats arrays with only blank segments as not meaningful', () => {
    expect(hasMeaningfulKeywordObject({
      Aliases: ['   '],
      ShortName: ''
    })).toBe(false)
  })

  test('treats scalar fields as meaningful even when another array field is blank', () => {
    expect(hasMeaningfulKeywordObject({
      Aliases: ['   '],
      ShortName: 'Fallback Short Name'
    })).toBe(true)
  })

  test('treats falsy array segments as blank while still honoring later meaningful values', () => {
    expect(hasMeaningfulKeywordObject({
      Aliases: [null, 'Meaningful Alias']
    })).toBe(true)
  })
})
