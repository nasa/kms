import {
  describe,
  expect,
  test
} from 'vitest'

import { toTitleCase } from '../toTitleCase'

describe('toTitleCase', () => {
  test('converts a lowercase string to title case', () => {
    expect(toTitleCase('hello world')).toBe('Hello World')
  })

  test('converts an uppercase string to title case', () => {
    expect(toTitleCase('THE QUICK BROWN FOX')).toBe('The Quick Brown Fox')
  })

  test('handles mixed case strings', () => {
    expect(toTitleCase('a MiXeD cAsE string')).toBe('A Mixed Case String')
  })

  test('handles a long sentence', () => {
    expect(toTitleCase('this is a long sentence with many words'))
      .toBe('This Is A Long Sentence With Many Words')
  })

  test('handles single-word input', () => {
    expect(toTitleCase('word')).toBe('Word')
  })

  test('handles empty string', () => {
    expect(toTitleCase('')).toBe('')
  })

  test('handles string with extra spaces', () => {
    expect(toTitleCase('  extra  spaces  ')).toBe('  Extra  Spaces  ')
  })

  test('handles string with special characters', () => {
    expect(toTitleCase('hello-world! what_now?')).toBe('Hello-world! What_now?')
  })
})
