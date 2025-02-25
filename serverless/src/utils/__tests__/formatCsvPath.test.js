import formatCsvPath from '../formatCsvPath'

describe('formatPath', () => {
  describe('platforms, instruments, projects schemes', () => {
    const schemes = ['platforms', 'instruments', 'projects']

    schemes.forEach((scheme) => {
      it(`should return the path as is when path length equals maxLevel for ${scheme}`, () => {
        const result = formatCsvPath(scheme, 5, ['a', 'b', 'c'], false)
        expect(result).toEqual(['a', 'b', 'c'])
      })

      it(`should pad the path with spaces when path length is less than maxLevel and not a leaf for ${scheme}`, () => {
        const result = formatCsvPath(scheme, 6, ['a', 'b'], false)
        expect(result).toEqual(['a', 'b', ' ', ' '])
      })

      it(`should insert a space at maxLevel - 2 when path length is less than maxLevel and is a leaf for ${scheme}`, () => {
        const result = formatCsvPath(scheme, 6, ['a', 'b', 'c'], true)
        expect(result).toEqual(['a', 'b', ' ', 'c'])
      })
    })
  })

  describe('sciencekeywords, chronounits, locations, discipline, rucontenttype, measurementname schemes', () => {
    const schemes = ['sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', 'measurementname']

    schemes.forEach((scheme) => {
      it(`should return the path as is when path length equals maxLevel for ${scheme}`, () => {
        const result = formatCsvPath(scheme, 4, ['a', 'b', 'c'], false)
        expect(result).toEqual(['a', 'b', 'c'])
      })

      it(`should pad the path with spaces when path length is less than maxLevel for ${scheme}`, () => {
        const result = formatCsvPath(scheme, 5, ['a', 'b'], false)
        expect(result).toEqual(['a', 'b', ' ', ' '])
      })
    })
  })

  describe('providers scheme', () => {
    it('should return the path as is when path length equals maxLevel', () => {
      const result = formatCsvPath('providers', 5, ['a', 'b'], false)
      expect(result).toEqual(['a', 'b'])
    })

    it('should pad the path with spaces when path length is less than maxLevel and not a leaf', () => {
      const result = formatCsvPath('providers', 6, ['a', 'b'], false)
      expect(result).toEqual(['a', 'b', ' '])
    })

    it('should insert spaces before the last element when path length is less than maxLevel and is a leaf', () => {
      const result = formatCsvPath('providers', 6, ['a', 'b'], true)
      expect(result).toEqual(['a', ' ', 'b'])
    })
  })

  it('should return the path as is for unknown schemes', () => {
    const result = formatCsvPath('unknown', 5, ['a', 'b', 'c'], false)
    expect(result).toEqual(['a', 'b', 'c'])
  })
})
