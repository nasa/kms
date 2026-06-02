import {
  buildKeywordPathFromValue,
  extractShortNameLookupValue,
  flattenKeywordPathValue,
  formatKeywordCsvPath,
  isHistoricalCacheFullPathScheme,
  isHistoricalCacheShortNameScheme,
  isLookupFullPathScheme,
  isPublishedCacheFullPathScheme,
  isLookupShortNameScheme,
  isPublishedCacheShortNameScheme,
  joinKeywordPath,
  normalizeKeywordScheme,
  splitKeywordPath
} from '../keywordPaths'

describe('keywordPaths', () => {
  test('buildKeywordPathFromValue preserves interior holes for slotted schemes', () => {
    expect(buildKeywordPathFromValue({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        Term: '',
        VariableLevel1: 'SNOW/ICE'
      }
    })).toEqual('EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > ')
  })

  test('buildKeywordPathFromValue pads array input for slotted schemes', () => {
    expect(buildKeywordPathFromValue({
      scheme: 'sciencekeywords',
      keywordValue: ['EARTH SCIENCE', 'ATMOSPHERE']
    })).toEqual('EARTH SCIENCE > ATMOSPHERE >  >  >  >  > ')
  })

  test('buildKeywordPathFromValue leaves scalar no-slot schemes unchanged', () => {
    expect(buildKeywordPathFromValue({
      scheme: 'temporalresolutionrange',
      keywordValue: 'P1D'
    })).toEqual('P1D')
  })

  test('extractShortNameLookupValue reads short names directly from structured values', () => {
    expect(extractShortNameLookupValue({
      ShortName: 'SPOT-4'
    })).toEqual('SPOT-4')
  })

  test('extractShortNameLookupValue returns an empty string for missing values', () => {
    expect(extractShortNameLookupValue(undefined)).toEqual('')
    expect(extractShortNameLookupValue(null)).toEqual('')
  })

  test('extractShortNameLookupValue supports scalar short-name inputs', () => {
    expect(extractShortNameLookupValue('TERRA')).toEqual('TERRA')
    expect(extractShortNameLookupValue(42)).toEqual('42')
  })

  test('extractShortNameLookupValue returns an empty string when ShortName is missing', () => {
    expect(extractShortNameLookupValue({
      LongName: 'Terra (satellite)'
    })).toEqual('')
  })

  test('formatKeywordCsvPath inserts sparse platform padding before the leaf segment', () => {
    const path = ['Earth Observation Satellites', 'SPOT-4']

    expect(formatKeywordCsvPath({
      scheme: 'platforms',
      csvHeadersCount: 5,
      path,
      isLeaf: true
    })).toEqual(['Earth Observation Satellites', '', 'SPOT-4'])
  })

  test('formatKeywordCsvPath preserves provider short names in the final slot', () => {
    const path = ['KPDC']

    expect(formatKeywordCsvPath({
      scheme: 'providers',
      csvHeadersCount: 6,
      path,
      isLeaf: true
    })).toEqual(['', '', 'KPDC'])
  })

  test('formatKeywordCsvPath appends blanks for non-leaf hierarchical schemes', () => {
    const path = ['EARTH SCIENCE', 'ATMOSPHERE']

    expect(formatKeywordCsvPath({
      scheme: 'sciencekeywords',
      csvHeadersCount: 5,
      path,
      isLeaf: false
    })).toEqual(['EARTH SCIENCE', 'ATMOSPHERE', '', ''])
  })

  test('formatKeywordCsvPath leaves unknown schemes unchanged', () => {
    const path = ['a', 'b']

    expect(formatKeywordCsvPath({
      scheme: 'unknown',
      csvHeadersCount: 5,
      path,
      isLeaf: false
    })).toBe(path)
  })

  test('formatKeywordCsvPath leaves overlong hierarchical paths unchanged', () => {
    const path = ['a', 'b', 'c', 'd', 'e']

    expect(formatKeywordCsvPath({
      scheme: 'sciencekeywords',
      csvHeadersCount: 4,
      path,
      isLeaf: false
    })).toBe(path)
  })

  test('formatKeywordCsvPath leaves overlong provider leaf paths unchanged', () => {
    const path = ['a', 'b', 'c', 'd']

    expect(formatKeywordCsvPath({
      scheme: 'providers',
      csvHeadersCount: 5,
      path,
      isLeaf: true
    })).toBe(path)
  })

  test('scheme classifiers stay centralized in one module', () => {
    expect(isLookupFullPathScheme('sciencekeywords')).toBe(true)
    expect(isLookupShortNameScheme('platforms')).toBe(true)
    expect(isHistoricalCacheFullPathScheme('verticalresolutionrange')).toBe(false)
    expect(isHistoricalCacheShortNameScheme('platforms')).toBe(true)
    expect(isPublishedCacheFullPathScheme('sciencekeywords')).toBe(true)
    expect(isPublishedCacheShortNameScheme('granuledataformat')).toBe(true)
    expect(normalizeKeywordScheme()).toEqual('')
  })

  test('splitKeywordPath preserves empty slots', () => {
    expect(splitKeywordPath('Space-based Platforms > Earth Observation Satellites >  > SPOT-4'))
      .toEqual(['Space-based Platforms', 'Earth Observation Satellites', '', 'SPOT-4'])
    expect(splitKeywordPath()).toEqual([''])
  })

  test('joinKeywordPath trims and preserves blank segments', () => {
    expect(joinKeywordPath([' Earth Science ', undefined, ' Atmosphere ']))
      .toEqual('Earth Science >  > Atmosphere')
    expect(joinKeywordPath()).toEqual('')
  })

  test('flattenKeywordPathValue handles null and nested object values', () => {
    expect(flattenKeywordPathValue(null)).toEqual([])
    expect(flattenKeywordPathValue({
      URLContentType: 'CollectionURL',
      nested: {
        Type: 'PROJECT HOME PAGE'
      }
    })).toEqual(['CollectionURL', 'PROJECT HOME PAGE'])
  })
})
