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
})
