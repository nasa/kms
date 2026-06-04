import { hasKeywordObjectValue } from '../hasKeywordObjectValue'

describe('hasKeywordObjectValue', () => {
  test('recognizes effectively empty keyword objects', () => {
    expect(hasKeywordObjectValue({
      Category: '',
      Topic: '',
      Term: ''
    })).toBe(false)
  })

  test('recognizes keyword objects with at least one meaningful value', () => {
    expect(hasKeywordObjectValue({
      Category: '',
      Topic: 'CRYOSPHERE'
    })).toBe(true)
  })
})
