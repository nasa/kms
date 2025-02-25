import getCsvLongNameFlag from '../getCsvLongNameFlag'

describe('longNameFlag', () => {
  it('returns true for schemes that require long names', () => {
    const schemesWithLongNames = ['platforms', 'instruments', 'projects', 'providers', 'idnnode']

    schemesWithLongNames.forEach((scheme) => {
      expect(getCsvLongNameFlag(scheme)).toBe(true)
    })
  })

  it('returns false for schemes that do not require long names', () => {
    const schemesWithoutLongNames = ['other', 'random', 'scheme']

    schemesWithoutLongNames.forEach((scheme) => {
      expect(getCsvLongNameFlag(scheme)).toBe(false)
    })
  })

  it('returns false for an empty string', () => {
    expect(getCsvLongNameFlag('')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(getCsvLongNameFlag('Platforms')).toBe(false)
    expect(getCsvLongNameFlag('INSTRUMENTS')).toBe(false)
  })
})
