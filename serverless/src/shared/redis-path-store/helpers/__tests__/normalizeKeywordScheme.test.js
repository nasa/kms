import { normalizeKeywordScheme } from '../normalizeKeywordScheme'

describe('normalizeKeywordScheme', () => {
  test('normalizes scheme names case-insensitively and treats missing input as blank', () => {
    expect(normalizeKeywordScheme('ScienceKeywords')).toBe('sciencekeywords')
    expect(normalizeKeywordScheme()).toBe('')
  })
})
