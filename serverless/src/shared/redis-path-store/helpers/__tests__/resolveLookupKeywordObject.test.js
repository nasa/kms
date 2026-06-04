import {
  buildKeywordLookupObject,
  buildShortNameLookupValue,
  extractShortNameLookupValue,
  resolveLookupKeywordObject
} from '../resolveLookupKeywordObject'

describe('resolveLookupKeywordObject', () => {
  test('buildKeywordLookupObject returns canonical slotted objects for full-path schemes', () => {
    expect(buildKeywordLookupObject({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        VariableLevel1: 'SNOW/ICE'
      }
    })).toEqual({
      Category: 'EARTH SCIENCE',
      Topic: 'CRYOSPHERE',
      Term: '',
      VariableLevel1: 'SNOW/ICE',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })
  })

  test('buildKeywordLookupObject returns short-name objects and empty objects when no lookup value exists', () => {
    expect(buildKeywordLookupObject({
      scheme: 'platforms',
      keywordValue: {
        ShortName: 'AQUA'
      }
    })).toEqual({
      ShortName: 'AQUA'
    })

    expect(buildKeywordLookupObject({
      scheme: 'sciencekeywords',
      keywordValue: undefined
    })).toEqual({})

    expect(buildKeywordLookupObject({
      scheme: 'platforms',
      keywordValue: {}
    })).toEqual({})

    expect(buildKeywordLookupObject({
      scheme: 'unknownscheme',
      keywordValue: {
        Value: 'P1D'
      }
    })).toEqual({})
  })

  test('extractShortNameLookupValue and buildShortNameLookupValue handle scalar and object values', () => {
    expect(extractShortNameLookupValue({
      ShortName: 'SPOT-4'
    })).toBe('SPOT-4')

    expect(extractShortNameLookupValue('TERRA')).toBe('TERRA')
    expect(extractShortNameLookupValue(undefined)).toBe('')

    expect(buildShortNameLookupValue({
      Format: 'netCDF-4'
    })).toBe('netCDF-4')

    expect(buildShortNameLookupValue(undefined)).toBeUndefined()

    expect(buildShortNameLookupValue(42)).toBe('42')
  })

  test('buildKeywordLookupObject falls back to scalar full-path values for non-slotted full-path schemes', () => {
    expect(buildKeywordLookupObject({
      scheme: 'temporalresolutionrange',
      keywordValue: 'P1D'
    })).toEqual({
      Value: 'P1D'
    })
  })

  test('resolveLookupKeywordObject prefers explicit keyword objects when they contain values', () => {
    expect(resolveLookupKeywordObject({
      scheme: 'platforms',
      keywordObject: {
        ShortName: 'AQUA'
      },
      keywordValue: {
        ShortName: 'TERRA'
      }
    })).toEqual({
      ShortName: 'AQUA'
    })
  })

  test('resolveLookupKeywordObject falls back to keywordValue when the explicit keyword object is empty', () => {
    expect(resolveLookupKeywordObject({
      scheme: 'platforms',
      keywordObject: {},
      keywordValue: {
        ShortName: 'TERRA'
      }
    })).toEqual({
      ShortName: 'TERRA'
    })
  })
})
