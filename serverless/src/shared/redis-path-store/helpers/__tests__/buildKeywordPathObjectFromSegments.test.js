import { buildKeywordPathObjectFromSegments } from '../buildKeywordPathObjectFromSegments'

describe('buildKeywordPathObjectFromSegments', () => {
  test('pads missing slotted segments with blanks', () => {
    expect(buildKeywordPathObjectFromSegments({
      scheme: 'sciencekeywords',
      segments: ['EARTH SCIENCE', 'OCEANS']
    })).toEqual({
      Category: 'EARTH SCIENCE',
      Topic: 'OCEANS',
      Term: '',
      VariableLevel1: '',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })
  })

  test('returns an empty object for schemes without slotted fields', () => {
    expect(buildKeywordPathObjectFromSegments({
      scheme: 'platforms',
      segments: ['Aqua']
    })).toEqual({})
  })

  test('defaults missing segments to an empty slotted keyword object', () => {
    expect(buildKeywordPathObjectFromSegments({
      scheme: 'sciencekeywords'
    })).toEqual({
      Category: '',
      Topic: '',
      Term: '',
      VariableLevel1: '',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })
  })
})
