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
import { getVersionMetadata } from '../getVersionMetadata'

// Mock the sparqlRequest function
vi.mock('@/shared/sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

vi.mock('@/shared/getVersionMetadata', () => ({
  getVersionMetadata: vi.fn()
}))

describe('getCsvMetadata', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-06-15T12:00:00Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    getVersionMetadata.mockResolvedValue({ versionName: '20.1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('when successful', () => {
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
        'Keyword Version: 20.1',
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

    test('should use "N/A" for Keyword Version when versionInfo has no versionName', async () => {
      // Mock getVersionMetadata to return an object without versionName
      getVersionMetadata.mockResolvedValue({ someOtherProperty: 'value' })

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
        'Keyword Version: N/A',
        'Revision: 2023-06-14',
        `Timestamp: ${format(new Date('2023-06-15T12:00:00Z'), 'yyyy-MM-dd HH:mm:ss')}`,
        'Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
        'The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/testScheme/?format=xml'
      ])
    })
  })

  describe('when unsuccessful', () => {
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
})
