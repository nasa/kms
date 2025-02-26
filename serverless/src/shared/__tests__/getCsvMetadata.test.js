import { format } from 'date-fns'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { getCsvMetadata } from '../getCsvMetadata'

// Mock the sparqlRequest function
vi.mock('@/shared/sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('getCsvMetadata', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('should return correct metadata when sparqlRequest is successful', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              modified: { value: '2023-06-14' }
            }
          ]
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getCsvMetadata('testScheme')

    expect(result).toEqual([
      'Keyword Version: N',
      'Revision: 2023-06-14',
      `Timestamp: ${format(new Date('2023-06-15T12:00:00Z'), 'yyyy-MM-dd HH:mm:ss')}`,
      'Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
      'The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/testScheme/?format=xml'
    ])
  })

  test('should handle case when sparqlRequest returns no data', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getCsvMetadata('testScheme')

    expect(result[1]).toBe('Revision: undefined')
  })

  test('should throw an error when sparqlRequest fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getCsvMetadata('testScheme')).rejects.toThrow('HTTP error! status: 500')
  })

  test('should throw an error when sparqlRequest throws an error', async () => {
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(getCsvMetadata('testScheme')).rejects.toThrow('Network error')
  })
})
