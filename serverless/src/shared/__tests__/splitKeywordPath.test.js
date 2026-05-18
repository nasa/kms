import {
  describe,
  expect,
  test
} from 'vitest'

import { splitKeywordPath } from '../splitKeywordPath'

describe('splitKeywordPath', () => {
  test('should split a standard keyword path into an array', () => {
    const input = 'EARTH SCIENCE > ATMOSPHERE > ATMOSPHERIC CHEMISTRY'
    const result = splitKeywordPath(input)
    expect(result).toEqual(['EARTH SCIENCE', 'ATMOSPHERE', 'ATMOSPHERIC CHEMISTRY'])
  })

  test('should trim leading and trailing whitespace from segments', () => {
    const input = ' EARTH SCIENCE  > ATMOSPHERE  > ATMOSPHERIC CHEMISTRY '
    const result = splitKeywordPath(input)
    expect(result).toEqual(['EARTH SCIENCE', 'ATMOSPHERE', 'ATMOSPHERIC CHEMISTRY'])
  })

  test('should preserve empty segments', () => {
    const input = 'Air-based Platforms > Dropwindsondes >  > Dropsondes > '
    const result = splitKeywordPath(input)
    expect(result).toEqual(['Air-based Platforms', 'Dropwindsondes', '', 'Dropsondes', ''])
  })

  test('should return an array with one empty string when input is empty', () => {
    expect(splitKeywordPath('')).toEqual([''])
    expect(splitKeywordPath()).toEqual([''])
  })

  test('should handle strings that do not contain the delimiter', () => {
    const input = 'ATMOSPHERIC CHEMISTRY'
    const result = splitKeywordPath(input)
    expect(result).toEqual(['ATMOSPHERIC CHEMISTRY'])
  })

  test('should be sensitive to the specific delimiter', () => {
    // Note: the function expects spaces around the bracket
    const input = 'ATMOSPHERIC >CHEMISTRY'
    const result = splitKeywordPath(input)
    expect(result).toEqual(['ATMOSPHERIC >CHEMISTRY'])
  })
})
