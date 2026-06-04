import {
  describe,
  expect,
  test
} from 'vitest'

import { parseFullPathCsvRecords } from '../parseFullPathCsvRecords'

describe('parseFullPathCsvRecords', () => {
  test('builds a full-path-to-uuid map from exported full-path csv rows', () => {
    const csvContent = [
      '"Science_Keywords_v99.0.0"',
      '"Category","Topic","Term","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"',
      '"EARTH SCIENCE","CRYOSPHERE","","uuid-2"'
    ].join('\n')

    expect(parseFullPathCsvRecords(csvContent)).toEqual(new Map([
      ['EARTH SCIENCE > ATMOSPHERE > AEROSOLS', 'uuid-1'],
      ['EARTH SCIENCE > CRYOSPHERE > ', 'uuid-2']
    ]))
  })

  test('skips rows that do not contain at least a path and uuid column', () => {
    const csvContent = [
      '"Science_Keywords_v99.0.0"',
      '"Category","Topic","Term","UUID"',
      '"only-one-column"'
    ].join('\n')

    expect(parseFullPathCsvRecords(csvContent)).toEqual(new Map())
  })
})
