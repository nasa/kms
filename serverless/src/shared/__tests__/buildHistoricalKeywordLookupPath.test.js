import { buildHistoricalKeywordLookupPath } from '../buildHistoricalKeywordLookupPath'

describe('buildHistoricalKeywordLookupPath', () => {
  test('pads science keyword paths to the canonical slot count', () => {
    expect(buildHistoricalKeywordLookupPath({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).toEqual('EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ')
  })

  test('preserves interior holes when building a science keyword path from keywordValue', () => {
    expect(buildHistoricalKeywordLookupPath({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        Term: '',
        VariableLevel1: 'SNOW/ICE'
      }
    })).toEqual('EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > ')
  })

  test('pads location keyword paths to the canonical slot count', () => {
    expect(buildHistoricalKeywordLookupPath({
      scheme: 'locations',
      keywordValue: {
        Category: 'CONTINENT',
        Type: 'NORTH AMERICA'
      }
    })).toEqual('CONTINENT > NORTH AMERICA >  >  >  > ')
  })

  test('preserves the trailing blank subtype slot for related URL content type paths', () => {
    expect(buildHistoricalKeywordLookupPath({
      scheme: 'rucontenttype',
      keywordValue: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE'
      }
    })).toEqual('CollectionURL > PROJECT HOME PAGE > ')
  })

  test('leaves scalar schemes unchanged', () => {
    expect(buildHistoricalKeywordLookupPath({
      scheme: 'temporalresolutionrange',
      keywordValue: 'P1D'
    })).toEqual('P1D')
  })
})
