import { isLookupFullPathScheme } from '../isLookupFullPathScheme'

describe('isLookupFullPathScheme', () => {
  test('returns true only for full-path lookup schemes', () => {
    expect(isLookupFullPathScheme('sciencekeywords')).toBe(true)
    expect(isLookupFullPathScheme('platforms')).toBe(false)
  })
})
