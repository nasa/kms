import { format } from 'date-fns'
import {
  describe,
  expect,
  vi
} from 'vitest'

import getCsvMetadata from '../getCsvMetadata'

describe('getCsvMetadata', () => {
  test('should return an array of metadata strings', () => {
    const result = getCsvMetadata('testScheme')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(5)
  })

  test('should include the correct static metadata strings', () => {
    const result = getCsvMetadata('testScheme')
    expect(result).toContain('Keyword Version: N')
    expect(result).toContain('Revision: N')
    expect(result).toContain('Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf')
  })

  test('should include a correctly formatted timestamp', () => {
    vi.useFakeTimers()
    const fakeNow = new Date('2023-01-01T12:00:00Z')
    vi.setSystemTime(fakeNow)

    const result = getCsvMetadata('testScheme')
    const expectedTimestamp = `Timestamp: ${format(fakeNow, 'yyyy-MM-dd HH:mm:ss')}`
    expect(result).toContain(expectedTimestamp)

    vi.useRealTimers()
  })

  test('should include the correct XML representation URL', () => {
    const scheme = 'testScheme'
    const result = getCsvMetadata(scheme)
    const expectedUrl = `The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}/?format=xml`
    expect(result).toContain(expectedUrl)
  })
})
