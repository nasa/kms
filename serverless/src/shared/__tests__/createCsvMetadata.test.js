import { format } from 'date-fns'
import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { createCsvMetadata } from '../createCsvMetadata'

describe('createCsvMetadata', () => {
  test('When called with valid parameters, should return an array with correct metadata', () => {
    const mockDate = new Date('2023-05-20T12:00:00Z')
    vi.setSystemTime(mockDate)

    const params = {
      versionName: '1.0',
      scheme: 'test-scheme',
      versionCreationDate: '2023-05-19'
    }

    const result = createCsvMetadata(params)

    expect(result).toEqual([
      'Keyword Version: 1.0',
      'Revision: 2023-05-19',
      `Timestamp: ${format(mockDate, 'yyyy-MM-dd HH:mm:ss')}`,
      'Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
      'The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/test-scheme/?format=xml'
    ])
  })

  test('When called with different parameters, should return an array with updated metadata', () => {
    const mockDate = new Date('2023-06-15T15:30:00Z')
    vi.setSystemTime(mockDate)

    const params = {
      versionName: '2.1',
      scheme: 'another-scheme',
      versionCreationDate: '2023-06-14'
    }

    const result = createCsvMetadata(params)

    expect(result).toEqual([
      'Keyword Version: 2.1',
      'Revision: 2023-06-14',
      `Timestamp: ${format(mockDate, 'yyyy-MM-dd HH:mm:ss')}`,
      'Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
      'The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/another-scheme/?format=xml'
    ])
  })

  test('When called without parameters, should throw an error', () => {
    expect(() => createCsvMetadata()).toThrow()
  })
})
