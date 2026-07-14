import {
  describe,
  expect,
  test
} from 'vitest'

import {
  getScalarKeywordText,
  isSimpleFieldPath,
  normalizeValueObject,
  trimString
} from '../XmlUtils'

describe('XmlUtils', () => {
  describe('trimString', () => {
    test('trims whitespace from strings', () => {
      expect(trimString('  hello  ')).toBe('hello')
    })

    test('returns empty string for non-string inputs', () => {
      expect(trimString(null)).toBe('')
      expect(trimString(undefined)).toBe('')
      expect(trimString(123)).toBe('')
    })
  })

  describe('getScalarKeywordText', () => {
    test('prioritizes Value over ShortName', () => {
      const obj = {
        Value: '  Science  ',
        ShortName: 'Sci'
      }
      expect(getScalarKeywordText(obj)).toBe('Science')
    })

    test('falls back to ShortName if Value is missing', () => {
      const obj = { ShortName: '  Physics  ' }
      expect(getScalarKeywordText(obj)).toBe('Physics')
    })

    test('falls back to any available property if Value/ShortName are missing', () => {
      const obj = { Category: '  Oceanography  ' }
      expect(getScalarKeywordText(obj)).toBe('Oceanography')
    })
  })

  describe('normalizeValueObject', () => {
    test('extracts only requested keys and trims them', () => {
      const input = {
        Type: '  A  ',
        Subtype: '  B  ',
        Extra: 'C'
      }
      const keys = ['Type', 'Subtype']
      expect(normalizeValueObject(input, keys)).toEqual({
        Type: 'A',
        Subtype: 'B'
      })
    })
  })

  describe('isSimpleFieldPath', () => {
    test('validates simple absolute paths', () => {
      expect(isSimpleFieldPath('//DIF/Product_Level_Id')).toBe(true)
      expect(isSimpleFieldPath('//Root/Child/GrandChild')).toBe(true)
    })

    test('rejects invalid paths', () => {
      expect(isSimpleFieldPath('Root/Child')).toBe(false) // No //
      expect(isSimpleFieldPath('//123/Node')).toBe(false) // Invalid start
    })
  })
})
