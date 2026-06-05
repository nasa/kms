import { hasKeywordObjectValue } from '../hasKeywordObjectValue'

describe('hasKeywordObjectValue', () => {
  test('treats a missing keyword object as empty', () => {
    expect(hasKeywordObjectValue()).toBe(false)
  })

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
