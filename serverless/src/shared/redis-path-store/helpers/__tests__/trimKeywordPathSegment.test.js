import {
  describe,
  expect,
  test
} from 'vitest'

import { trimKeywordPathSegment } from '../trimKeywordPathSegment'

describe('trimKeywordPathSegment', () => {
  test('trims string-like path segments', () => {
    expect(trimKeywordPathSegment('  AEROSOLS  ')).toBe('AEROSOLS')
    expect(trimKeywordPathSegment(42)).toBe('42')
  })

  test('returns an empty string for nullish segment values', () => {
    expect(trimKeywordPathSegment(undefined)).toBe('')
    expect(trimKeywordPathSegment(null)).toBe('')
  })
})
