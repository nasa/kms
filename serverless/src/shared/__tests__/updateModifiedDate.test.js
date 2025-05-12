import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getUpdateModifiedDateQuery } from '@/shared/operations/updates/getUpdateModifiedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { updateModifiedDate } from '@/shared/updateModifiedDate'

// Mock the dependencies
vi.mock('@/shared/operations/updates/getUpdateModifiedDateQuery')
vi.mock('@/shared/sparqlRequest')

describe('updateModifiedDate', () => {
  const mockConceptId = '123'
  const mockVersion = 'draft'
  const mockDate = '2023-05-15T10:30:00Z'
  const mockQuery = 'MOCK SPARQL UPDATE QUERY'
  const transactionUrl = 'transactionUrl'

  beforeEach(() => {
    vi.resetAllMocks()
    getUpdateModifiedDateQuery.mockReturnValue(mockQuery)
  })

  test('should return true when the update is successful', async () => {
    const mockResponse = {
      ok: true
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await updateModifiedDate(mockConceptId, mockVersion, mockDate, transactionUrl)

    expect(getUpdateModifiedDateQuery).toHaveBeenCalledWith(mockConceptId, mockDate)
    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'PUT',
      body: mockQuery,
      contentType: 'application/sparql-update',
      version: mockVersion,
      transaction: {
        transactionUrl,
        action: 'UPDATE'
      }
    })

    expect(result).toBe(true)
  })

  test('should return false when the update fails', async () => {
    const mockResponse = {
      ok: false
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await updateModifiedDate(mockConceptId, mockVersion, mockDate)

    expect(result).toBe(false)
  })

  test('should handle SPARQL request errors', async () => {
    sparqlRequest.mockRejectedValue(new Error('SPARQL update failed'))

    await expect(updateModifiedDate(mockConceptId, mockVersion, mockDate)).rejects.toThrow('SPARQL update failed')
  })

  test('should pass the correct parameters to getUpdateModifiedDateQuery', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await updateModifiedDate(mockConceptId, mockVersion, mockDate)

    expect(getUpdateModifiedDateQuery).toHaveBeenCalledWith(mockConceptId, mockDate)
  })

  test('should use the provided version in the SPARQL request', async () => {
    const customVersion = 'published'
    sparqlRequest.mockResolvedValue({ ok: true })

    await updateModifiedDate(mockConceptId, customVersion, mockDate)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      version: customVersion
    }))
  })
})
