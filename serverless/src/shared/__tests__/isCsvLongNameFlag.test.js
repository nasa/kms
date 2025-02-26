import { isCsvLongNameFlag } from '../isCsvLongNameFlag'

describe('longNameFlag', () => {
  test('returns true for schemes that require long names', () => {
    const schemesWithLongNames = ['platforms', 'instruments', 'projects', 'providers', 'idnnode']

    schemesWithLongNames.forEach((scheme) => {
      expect(isCsvLongNameFlag(scheme)).toBe(true)
    })
  })

  test('returns false for schemes that do not require long names', () => {
    const schemesWithoutLongNames = ['other', 'random', 'scheme']

    schemesWithoutLongNames.forEach((scheme) => {
      expect(isCsvLongNameFlag(scheme)).toBe(false)
    })
  })

  test('returns false for an empty string', () => {
    expect(isCsvLongNameFlag('')).toBe(false)
  })

  test('is case-sensitive', () => {
    expect(isCsvLongNameFlag('Platforms')).toBe(false)
    expect(isCsvLongNameFlag('INSTRUMENTS')).toBe(false)
  })
})
