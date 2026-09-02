import { getKeywordPathFromKeywordObject } from '../getKeywordPathFromKeywordObject'

describe('getKeywordPathFromKeywordObject', () => {
  test('returns undefined for unknown schemes and invalid keyword objects', () => {
    expect(getKeywordPathFromKeywordObject({
      scheme: 'customscalar',
      keywordObject: {
        Value: 'P1D'
      }
    })).toBeUndefined()

    expect(getKeywordPathFromKeywordObject({
      scheme: 'customscalar',
      keywordObject: null
    })).toBeUndefined()
  })

  test('returns canonical short-name and full-path keyword paths', () => {
    expect(getKeywordPathFromKeywordObject({
      scheme: 'platforms',
      keywordObject: {
        Basis: 'Space-based Platforms',
        Category: 'Earth Observation Satellites',
        SubCategory: '',
        ShortName: 'Aqua'
      }
    })).toBe('Space-based Platforms > Earth Observation Satellites >  > Aqua')

    expect(getKeywordPathFromKeywordObject({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        VariableLevel1: 'SNOW/ICE'
      }
    })).toBe('EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > ')

    expect(getKeywordPathFromKeywordObject({
      scheme: 'providers',
      keywordObject: {
        BucketLevel0: 'ARCHIVER',
        BucketLevel1: '',
        BucketLevel2: '',
        BucketLevel3: '',
        ShortName: 'NZ/NZAI/ANZ'
      }
    })).toBe('ARCHIVER >  >  >  > NZ/NZAI/ANZ')

    expect(getKeywordPathFromKeywordObject({
      scheme: 'rucontenttype',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })).toBe('CollectionURL > PROJECT HOME PAGE > ')
  })

  test('returns undefined for short-name keyword objects whose segments are all blank', () => {
    expect(getKeywordPathFromKeywordObject({
      scheme: 'platforms',
      keywordObject: {
        Basis: '',
        Category: '',
        SubCategory: '',
        ShortName: ''
      }
    })).toBeUndefined()
  })
})
