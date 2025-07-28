import { formatCsvPath } from '../formatCsvPath'

describe('formatPath', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('when successful', () => {
    describe('platforms, instruments, projects schemes', () => {
      const schemes = ['platforms', 'instruments', 'projects']

      schemes.forEach((scheme) => {
        describe(`for ${scheme}`, () => {
          test('should return the path as is when path length equals maxLevel', () => {
            const result = formatCsvPath(scheme, 5, ['a', 'b', 'c'], false)
            expect(result).toEqual(['a', 'b', 'c'])
          })

          test('should pad spaces to the end when path is shorter than maxLevel and not a leaf', () => {
            const result = formatCsvPath('instruments', 6, ['Instrument1'], false)
            expect(result).toEqual(['Instrument1', ' ', ' ', ' '])
          })

          test('should pad spaces before short name when path is shorter than maxLevel and is a leaf', () => {
            const result = formatCsvPath('instruments', 6, ['Instrument1', 'ShortName'], true)
            expect(result).toEqual(['Instrument1', ' ', ' ', 'ShortName'])
          })
        })
      })
    })

    describe('sciencekeywords, chronounits, locations, discipline, rucontenttype, measurementname schemes', () => {
      const schemes = ['sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', 'measurementname']

      schemes.forEach((scheme) => {
        describe(`for ${scheme}`, () => {
          test('should return the path as is when path length equals maxLevel', () => {
            const result = formatCsvPath(scheme, 4, ['a', 'b', 'c'], false)
            expect(result).toEqual(['a', 'b', 'c'])
          })

          test('should pad the path with spaces when path length is less than maxLevel', () => {
            const result = formatCsvPath(scheme, 5, ['a', 'b'], false)
            expect(result).toEqual(['a', 'b', ' ', ' '])
          })
        })
      })
    })

    describe('providers scheme', () => {
      test('should return the path as is when path length equals maxLevel', () => {
        const result = formatCsvPath('providers', 5, ['a', 'b'], false)
        expect(result).toEqual(['a', 'b'])
      })

      test('should pad the path with spaces when path length is less than maxLevel and not a leaf', () => {
        const result = formatCsvPath('providers', 6, ['a', 'b'], false)
        expect(result).toEqual(['a', 'b', ' '])
      })

      test('should insert spaces before the last element when path length is less than maxLevel and is a leaf', () => {
        const result = formatCsvPath('providers', 6, ['a', 'b'], true)
        expect(result).toEqual(['a', ' ', 'b'])
      })
    })

    describe('edge cases', () => {
      test('should return the original path for platforms scheme when path length equals maxLevel', () => {
        const result = formatCsvPath('platforms', 4, ['a', 'b', 'c', 'd'], true)
        expect(result).toEqual(['a', 'b', 'c', 'd'])
      })

      test('should return the original path for sciencekeywords scheme when path length shorter than maxLevel', () => {
        const result = formatCsvPath('sciencekeywords', 4, ['a', 'b'], false)
        expect(result).toEqual(['a', 'b', ' '])
      })

      test('should return the original path for providers scheme when path length equals maxLevel', () => {
        const result = formatCsvPath('providers', 8, ['a', 'b'], true)
        expect(result).toEqual(['a', ' ', ' ', ' ', 'b'])
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should return the path as is for unknown schemes', () => {
      const result = formatCsvPath('unknown', 5, ['a', 'b', 'c'], false)
      expect(result).toEqual(['a', 'b', 'c'])
    })
  })
})
