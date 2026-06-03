import {
  describe,
  expect,
  test
} from 'vitest'

import { formatKeywordObjectForLog } from '../formatKeywordObjectForLog'

describe('formatKeywordObjectForLog', () => {
  test('formats missing or blank keyword objects as n/a', () => {
    expect(formatKeywordObjectForLog(undefined)).toBe('n/a')
    expect(formatKeywordObjectForLog({
      Aliases: ['   '],
      ShortName: ''
    })).toBe('n/a')
  })

  test('formats meaningful keyword objects as JSON', () => {
    expect(formatKeywordObjectForLog({
      ShortName: 'Legacy Climate Study'
    })).toBe('{"ShortName":"Legacy Climate Study"}')
  })
})
