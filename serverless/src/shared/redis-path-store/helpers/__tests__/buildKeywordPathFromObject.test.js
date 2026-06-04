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
        Category: '',
        Class: 'Space-based Platforms',
        Type: 'Earth Observation Satellites',
        ShortName: 'Aqua'
      }
    })).toEqual('Space-based Platforms > Earth Observation Satellites > Aqua')
  })

  test('flattens scalar objects for non-slotted schemes', () => {
    expect(buildKeywordPathFromObject({
      scheme: 'temporalresolutionrange',
      keywordObject: {
        Value: 'P1D'
      }
    })).toEqual('P1D')
  })
})
