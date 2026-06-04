import {
  buildFullPathLookupValue,
  buildKeywordPathFromValue
} from '../buildFullPathLookupValue'

describe('buildFullPathLookupValue', () => {
  test('buildKeywordPathFromValue pads science keyword paths to the canonical slot count', () => {
    expect(buildKeywordPathFromValue({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).toEqual('EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ')
  })

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

  test('buildKeywordPathFromValue leaves scalar schemes unchanged', () => {
    expect(buildKeywordPathFromValue({
      scheme: 'temporalresolutionrange',
      keywordValue: 'P1D'
    })).toEqual('P1D')
  })

  test('buildFullPathLookupValue returns canonical slotted paths only when usable values exist', () => {
    expect(buildFullPathLookupValue({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        VariableLevel1: 'SNOW/ICE'
      }
    })).toEqual('EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > ')

    expect(buildFullPathLookupValue({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: '',
        Topic: '',
        Term: ''
      }
    })).toBeUndefined()
  })

  test('buildFullPathLookupValue returns scalar lookup values only when non-blank', () => {
    expect(buildFullPathLookupValue({
      scheme: 'temporalresolutionrange',
      keywordValue: 'P1D'
    })).toEqual('P1D')

    expect(buildFullPathLookupValue({
      scheme: 'temporalresolutionrange',
      keywordValue: '   '
    })).toBeUndefined()
  })
})
