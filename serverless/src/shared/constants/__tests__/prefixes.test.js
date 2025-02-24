import { namespaces } from '../namespaces'
import { prefixes } from '../prefixes'

describe('prefixes', () => {
  test('should generate PREFIX declarations for all namespaces', () => {
    const expectedPrefixes = Object.entries(namespaces)
      .map(([key, value]) => `PREFIX ${key.replace('@xmlns:', '')}: <${value}>`)
      .join('\n')

    expect(prefixes).toBe(expectedPrefixes)
  })

  test('should include all namespaces', () => {
    Object.entries(namespaces).forEach(([key, value]) => {
      const prefix = key.replace('@xmlns:', '')
      expect(prefixes).toContain(`PREFIX ${prefix}: <${value}>`)
    })
  })

  test('should not have any extra lines', () => {
    const lineCount = prefixes.split('\n').length
    expect(lineCount).toBe(Object.keys(namespaces).length)
  })

  test('should not have any empty lines', () => {
    expect(prefixes).not.toContain('\n\n')
  })

  test('should start with "PREFIX"', () => {
    expect(prefixes).toMatch(/^PREFIX/)
  })
})
