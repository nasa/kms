import { buildKeywordPathObjectFromValue } from '../buildKeywordPathObjectFromValue'

describe('buildKeywordPathObjectFromValue', () => {
  test('preserves named slot positions from keyword objects', () => {
    expect(buildKeywordPathObjectFromValue({
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

  test('flattens raw array values for slotted schemes and ignores unsupported schemes', () => {
    expect(buildKeywordPathObjectFromValue({
      scheme: 'sciencekeywords',
      keywordValue: ['EARTH SCIENCE', 'OCEANS']
    })).toEqual({
      Category: 'EARTH SCIENCE',
      Topic: 'OCEANS',
      Term: '',
      VariableLevel1: '',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })

    expect(buildKeywordPathObjectFromValue({
      scheme: 'temporalresolutionrange',
      keywordValue: 'P1D'
    })).toEqual({})
  })
})
