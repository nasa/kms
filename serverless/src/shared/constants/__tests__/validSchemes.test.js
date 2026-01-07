import { VALID_SCHEMES } from '../validSchemes'

describe('VALID_SCHEMES', () => {
  test('should be an array', () => {
    expect(Array.isArray(VALID_SCHEMES)).toBe(true)
  })

  test('should have the correct number of schemes', () => {
    expect(VALID_SCHEMES.length).toBe(10)
  })

  test('should contain all expected schemes', () => {
    const expectedSchemes = [
      'CollectionDataType',
      'DataFormat',
      'GranuleDataFormat',
      'instruments',
      'locations',
      'platforms',
      'ProductLevelId',
      'projects',
      'providers',
      'sciencekeywords'
    ]

    expectedSchemes.forEach((scheme) => {
      expect(VALID_SCHEMES).toContain(scheme)
    })
  })

  test('should not contain any duplicate schemes', () => {
    const uniqueSchemes = new Set(VALID_SCHEMES)
    expect(uniqueSchemes.size).toBe(VALID_SCHEMES.length)
  })

  test('all schemes should be strings', () => {
    VALID_SCHEMES.forEach((scheme) => {
      expect(typeof scheme).toBe('string')
    })
  })

  test('should not contain any empty strings', () => {
    VALID_SCHEMES.forEach((scheme) => {
      expect(scheme.trim()).not.toBe('')
    })
  })
})
