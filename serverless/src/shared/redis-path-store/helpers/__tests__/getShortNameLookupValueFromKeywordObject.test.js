import {
  describe,
  expect,
  test
} from 'vitest'

import {
  getShortNameLookupValueFromKeywordObject
} from '../getShortNameLookupValueFromKeywordObject'

describe('getShortNameLookupValueFromKeywordObject', () => {
  test('returns a trimmed short-name value when present', () => {
    expect(getShortNameLookupValueFromKeywordObject({
      ShortName: '  AQUA  '
    })).toBe('AQUA')
  })

  test('returns undefined when the short-name value is blank or missing', () => {
    expect(getShortNameLookupValueFromKeywordObject({
      ShortName: '   '
    })).toBeUndefined()

    expect(getShortNameLookupValueFromKeywordObject({})).toBeUndefined()
  })
})
