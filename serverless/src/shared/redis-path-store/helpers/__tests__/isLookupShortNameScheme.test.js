import { isLookupShortNameScheme } from '../isLookupShortNameScheme'

describe('isLookupShortNameScheme', () => {
  test('returns true only for short-name lookup schemes', () => {
    expect(isLookupShortNameScheme('platforms')).toBe(true)
    expect(isLookupShortNameScheme('sciencekeywords')).toBe(false)
  })
})
