import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getModifiedDate } from '@/shared/getModifiedDate'
import { getModifiedDateQuery } from '@/shared/operations/queries/getModifiedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

// Mock the dependencies
vi.mock('@/shared/operations/queries/getModifiedDateQuery')
vi.mock('@/shared/sparqlRequest')

describe('getModifiedDate', () => {
  const mockConceptId = '123'
  const mockVersion = 'draft'
  const mockQuery = 'MOCK SPARQL QUERY'

  beforeEach(() => {
    vi.resetAllMocks()
    getModifiedDateQuery.mockReturnValue(mockQuery)
  })

  test('should return the modified date when it exists', async () => {
    const mockModifiedDate = '2023-05-15T10:30:00Z'
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              modified: { value: mockModifiedDate }
            }
          ]
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getModifiedDate(mockConceptId, mockVersion)

    expect(getModifiedDateQuery).toHaveBeenCalledWith(mockConceptId)
    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/query',
      body: mockQuery,
      accept: 'application/sparql-results+json',
      version: mockVersion
    })

    expect(result).toBe(mockModifiedDate)
  })

  test('should return null when the modified date does not exist', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getModifiedDate(mockConceptId, mockVersion)

    expect(result).toBeNull()
  })

  test('should return null when the SPARQL request fails', async () => {
    const mockResponse = {
      ok: false
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getModifiedDate(mockConceptId, mockVersion)

    expect(result).toBeNull()
  })

  test('should handle SPARQL request errors', async () => {
    sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

    await expect(getModifiedDate(mockConceptId, mockVersion)).rejects.toThrow('SPARQL request failed')
  })
})
