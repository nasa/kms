import getCsvProviderUrlFlag from '../getCsvProviderUrlFlag'

describe('providerUrlFlag', () => {
  it('should return true for "providers" scheme', () => {
    expect(getCsvProviderUrlFlag('providers')).toBe(true)
  })

  it('should return false for non-"providers" schemes', () => {
    expect(getCsvProviderUrlFlag('other')).toBe(false)
    expect(getCsvProviderUrlFlag('random')).toBe(false)
    expect(getCsvProviderUrlFlag('')).toBe(false)
  })

  it('should return false for undefined input', () => {
    expect(getCsvProviderUrlFlag(undefined)).toBe(false)
  })

  it('should return false for null input', () => {
    expect(getCsvProviderUrlFlag(null)).toBe(false)
  })

  it('should return false for number input', () => {
    expect(getCsvProviderUrlFlag(123)).toBe(false)
  })

  it('should return false for object input', () => {
    expect(getCsvProviderUrlFlag({})).toBe(false)
  })

  it('should return false for array input', () => {
    expect(getCsvProviderUrlFlag([])).toBe(false)
  })
})
