import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getUpdateCreatedDateQuery } from '@/shared/operations/updates/getUpdateCreatedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { updateCreatedDate } from '@/shared/updateCreatedDate'

// Mock the dependencies
vi.mock('@/shared/operations/updates/getUpdateCreatedDateQuery')
vi.mock('@/shared/sparqlRequest')

describe('updateCreatedDate', () => {
  const mockConceptId = '123'
  const mockVersion = 'draft'
  const mockDate = '2023-05-15'
  const mockQuery = 'MOCK SPARQL UPDATE QUERY'

  beforeEach(() => {
    vi.resetAllMocks()
    getUpdateCreatedDateQuery.mockReturnValue(mockQuery)
  })

  test('should return true when the update is successful', async () => {
    const mockResponse = {
      ok: true
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await updateCreatedDate(mockConceptId, mockVersion, mockDate)

    expect(getUpdateCreatedDateQuery).toHaveBeenCalledWith(mockConceptId, mockDate)
    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/statements',
      body: mockQuery,
      contentType: 'application/sparql-update',
      version: mockVersion
    })

    expect(result).toBe(true)
  })

  test('should return false when the update fails', async () => {
    const mockResponse = {
      ok: false
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await updateCreatedDate(mockConceptId, mockVersion, mockDate)

    expect(result).toBe(false)
  })

  test('should handle SPARQL request errors', async () => {
    sparqlRequest.mockRejectedValue(new Error('SPARQL update failed'))

    await expect(updateCreatedDate(mockConceptId, mockVersion, mockDate)).rejects.toThrow('SPARQL update failed')
  })

  test('should pass the correct parameters to getUpdateCreatedDateQuery', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await updateCreatedDate(mockConceptId, mockVersion, mockDate)

    expect(getUpdateCreatedDateQuery).toHaveBeenCalledWith(mockConceptId, mockDate)
  })
})
