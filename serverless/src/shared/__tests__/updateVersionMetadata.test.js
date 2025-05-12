import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { updateVersionMetadata } from '../updateVersionMetadata'

// Mock the sparqlRequest function
vi.mock('@/shared/sparqlRequest')

describe('updateVersionMetadata', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('when supplying all fields', () => {
    test('should update version metadata successfully including lastSynced', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const params = {
        graphId: 'test-graph',
        version: '1.0',
        versionType: 'PUBLISHED',
        createdDate: '2023-01-01',
        modifiedDate: '2023-01-02',
        lastSynced: '2023-01-03',
        transactionUrl: 'transactionUrl'
      }

      const response = await updateVersionMetadata(params)

      expect(response.ok).toBe(true)
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'PUT',
        body: expect.stringContaining('INSERT {'),
        contentType: 'application/sparql-update',
        accept: 'application/json',
        transaction: {
          action: 'UPDATE',
          transactionUrl: 'transactionUrl'
        }
      })

      const sparqlCall = sparqlRequest.mock.calls[0][0]
      expect(sparqlCall.body).toContain('gcmd:versionName "1.0"')
      expect(sparqlCall.body).toContain('gcmd:versionType "PUBLISHED"')
      expect(sparqlCall.body).toContain('dcterms:created "2023-01-01"^^xsd:dateTime')
      expect(sparqlCall.body).toContain('gcmd:lastSynced "2023-01-03"^^xsd:dateTime')
    })
  })

  describe('when supplying partial fields', () => {
    test('should only update provided fields including lastSynced', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const params = {
        graphId: 'test-graph',
        versionType: 'DRAFT',
        lastSynced: '2023-01-03'
      }

      await updateVersionMetadata(params)

      const sparqlCall = sparqlRequest.mock.calls[0][0]
      expect(sparqlCall.body).toContain('gcmd:versionType "DRAFT"')
      expect(sparqlCall.body).toContain('gcmd:lastSynced "2023-01-03"^^xsd:dateTime')
      expect(sparqlCall.body).not.toContain('gcmd:versionName')
      expect(sparqlCall.body).not.toContain('dcterms:created')
      expect(sparqlCall.body).not.toContain('dcterms:modified')
    })
  })

  describe('when errors occur', () => {
    test('should handle errors when updating version metadata', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('SPARQL update failed')
      })

      const params = {
        graphId: 'test-graph',
        version: '1.0',
        lastSynced: '2023-01-03'
      }

      await expect(updateVersionMetadata(params)).rejects.toThrow('Failed to update version metadata: 500 Internal Server Error\nSPARQL update failed')
    })

    test('should handle network errors', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      const params = {
        graphId: 'test-graph',
        version: '1.0',
        lastSynced: '2023-01-03'
      }

      await expect(updateVersionMetadata(params)).rejects.toThrow('Network error')
    })
  })
})
