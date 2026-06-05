import {
  describe,
  expect,
  test
} from 'vitest'

import { getFullPathLookupValueFromKeywordObject } from '../getFullPathLookupValueFromKeywordObject'

describe('getFullPathLookupValueFromKeywordObject', () => {
  test('returns a canonical padded path for slotted full-path schemes', () => {
    expect(getFullPathLookupValueFromKeywordObject({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).toBe('EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ')
  })

  test('returns undefined when the keyword object has no usable full-path content', () => {
    expect(getFullPathLookupValueFromKeywordObject({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: '',
        Topic: '',
        Term: ''
      }
    })).toBeUndefined()
  })
})
