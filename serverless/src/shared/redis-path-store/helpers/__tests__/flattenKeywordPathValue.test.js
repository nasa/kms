import { flattenKeywordPathValue } from '../flattenKeywordPathValue'

describe('flattenKeywordPathValue', () => {
  test('preserves ordered scalar values from nested keyword content', () => {
    expect(flattenKeywordPathValue({
      Category: 'EARTH SCIENCE',
      Topic: 'CRYOSPHERE',
      VariableLevel1: 'SNOW/ICE'
    })).toEqual(['EARTH SCIENCE', 'CRYOSPHERE', 'SNOW/ICE'])
  })

  test('returns empty arrays for nullish values and flattens nested arrays', () => {
    expect(flattenKeywordPathValue(undefined)).toEqual([])
    expect(flattenKeywordPathValue(null)).toEqual([])
    expect(flattenKeywordPathValue('')).toEqual([''])
    expect(flattenKeywordPathValue(['A', ['B', 'C']])).toEqual(['A', 'B', 'C'])
  })
})
