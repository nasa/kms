import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getCreatedDate } from '@/shared/getCreatedDate'
import { getCreateDateQuery } from '@/shared/operations/queries/getCreatedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

// Mock the dependencies
vi.mock('@/shared/operations/queries/getCreatedDateQuery')
vi.mock('@/shared/sparqlRequest')

describe('getCreatedDate', () => {
  const mockConceptId = '123'
  const mockVersion = 'draft'
  const mockQuery = 'MOCK SPARQL QUERY'

  beforeEach(() => {
    vi.resetAllMocks()
    getCreateDateQuery.mockReturnValue(mockQuery)
  })

  test('should return the created date when it exists', async () => {
    const mockCreatedDate = '2023-05-15T10:30:00Z'
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              created: { value: mockCreatedDate }
            }
          ]
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getCreatedDate(mockConceptId, mockVersion)

    expect(getCreateDateQuery).toHaveBeenCalledWith(mockConceptId)
    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/query',
      body: mockQuery,
      accept: 'application/sparql-results+json',
      version: mockVersion
    })

    expect(result).toBe(mockCreatedDate)
  })

  test('should return null when the created date does not exist', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getCreatedDate(mockConceptId, mockVersion)

    expect(result).toBeNull()
  })

  test('should return null when the SPARQL request fails', async () => {
    const mockResponse = {
      ok: false
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getCreatedDate(mockConceptId, mockVersion)

    expect(result).toBeNull()
  })

  test('should handle SPARQL request errors', async () => {
    sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

    await expect(getCreatedDate(mockConceptId, mockVersion)).rejects.toThrow('SPARQL request failed')
  })
})
