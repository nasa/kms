import { isCsvProviderUrlFlag } from '../isCsvProviderUrlFlag'

describe('providerUrlFlag', () => {
  test('should return true for "providers" scheme', () => {
    expect(isCsvProviderUrlFlag('providers')).toBe(true)
  })

  test('should return false for non-"providers" schemes', () => {
    expect(isCsvProviderUrlFlag('other')).toBe(false)
    expect(isCsvProviderUrlFlag('random')).toBe(false)
    expect(isCsvProviderUrlFlag('')).toBe(false)
  })

  test('should return false for undefined input', () => {
    expect(isCsvProviderUrlFlag(undefined)).toBe(false)
  })

  test('should return false for null input', () => {
    expect(isCsvProviderUrlFlag(null)).toBe(false)
  })

  test('should return false for number input', () => {
    expect(isCsvProviderUrlFlag(123)).toBe(false)
  })

  test('should return false for object input', () => {
    expect(isCsvProviderUrlFlag({})).toBe(false)
  })

  test('should return false for array input', () => {
    expect(isCsvProviderUrlFlag([])).toBe(false)
  })
})
