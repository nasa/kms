import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { getVersionMetadata } from '../getVersionMetadata'

// Mock the sparqlRequest function
vi.mock('@/shared/sparqlRequest')

describe('getVersionMetadata', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('when a version is supplied', () => {
    test('should return metadata for a valid version', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [{
              versionName: { value: '1.0' },
              versionType: { value: 'PUBLISHED' },
              created: { value: '2023-01-01T00:00:00Z' },
              modified: { value: '2023-01-02T00:00:00Z' }
            }]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getVersionMetadata('1.0')

      expect(result).toEqual({
        version: '1.0',
        versionName: '1.0',
        versionType: 'PUBLISHED',
        created: '2023-01-01T00:00:00Z',
        modified: '2023-01-02T00:00:00Z'
      })

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        body: expect.stringContaining('SELECT ?versionType ?versionName ?created ?modified'),
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        version: '1.0'
      })
    })

    test('should return null for a non-existent version', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: []
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getVersionMetadata('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('when an error occurs', () => {
    test('should throw an error when the SPARQL request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('SPARQL query failed')
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getVersionMetadata('1.0')).rejects.toThrow('Failed to retrieve version metadata')
    })

    test('should throw an error when there is a network issue', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(getVersionMetadata('1.0')).rejects.toThrow('Network error')
    })
  })
})
