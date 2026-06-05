import { joinKeywordPath } from '../joinKeywordPath'

describe('joinKeywordPath', () => {
  test('joins normalized path segments with the canonical separator', () => {
    expect(joinKeywordPath(['EARTH SCIENCE', '', 'SNOW/ICE'])).toBe('EARTH SCIENCE >  > SNOW/ICE')
  })

  test('returns an empty path when no segments are provided', () => {
    expect(joinKeywordPath()).toBe('')
  })
})
