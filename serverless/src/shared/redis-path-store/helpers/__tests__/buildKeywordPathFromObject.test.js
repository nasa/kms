import { buildKeywordPathFromObject } from '../buildKeywordPathFromObject'

describe('buildKeywordPathFromObject', () => {
  test('rebuilds canonical slotted full paths', () => {
    expect(buildKeywordPathFromObject({
      scheme: 'rucontenttype',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })).toEqual('CollectionURL > PROJECT HOME PAGE > ')
  })

  test('rebuilds short-name hierarchy paths and trims leading empty segments', () => {
    expect(buildKeywordPathFromObject({
      scheme: 'platforms',
      keywordObject: {
        Basis: '',
        Category: 'Space-based Platforms',
        SubCategory: 'Earth Observation Satellites',
        ShortName: 'Aqua'
      }
    })).toEqual('Space-based Platforms > Earth Observation Satellites > Aqua')

    expect(buildKeywordPathFromObject({
      scheme: 'platforms',
      keywordObject: {
        Basis: '',
        Category: '',
        SubCategory: '',
        ShortName: ''
      }
    })).toEqual(' >  >  > ')
  })

  test('rebuilds short-name paths that include intentional blank slots', () => {
    expect(buildKeywordPathFromObject({
      scheme: 'platforms',
      keywordObject: {
        Basis: 'Other',
        Category: '',
        SubCategory: '',
        ShortName: 'Auxiliary Data'
      }
    })).toEqual('Other >  >  > Auxiliary Data')

    expect(buildKeywordPathFromObject({
      scheme: 'instruments',
      keywordObject: {
        Category: 'Earth Remote Sensing Instruments',
        Class: '',
        Type: '',
        Subtype: '',
        ShortName: 'MODIS'
      }
    })).toEqual('Earth Remote Sensing Instruments >  >  >  > MODIS')
  })

  test('flattens scalar objects for non-slotted schemes', () => {
    expect(buildKeywordPathFromObject({
      scheme: 'unsupported',
      keywordObject: {
        Value: 'P1D'
      }
    })).toEqual('P1D')
  })
})
