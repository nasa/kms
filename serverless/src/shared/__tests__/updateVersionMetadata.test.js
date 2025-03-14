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
    test('should update version metadata successfully', async () => {
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
        modifiedDate: '2023-01-02'
      }

      const response = await updateVersionMetadata(params)

      expect(response.ok).toBe(true)
      expect(sparqlRequest).toHaveBeenCalledWith({
        path: '/statements',
        method: 'POST',
        body: expect.stringContaining('INSERT {'),
        contentType: 'application/sparql-update',
        accept: 'application/json'
      })

      const sparqlCall = sparqlRequest.mock.calls[0][0]
      expect(sparqlCall.body).toContain('gcmd:versionName "1.0"')
      expect(sparqlCall.body).toContain('gcmd:versionType "PUBLISHED"')
      expect(sparqlCall.body).toContain('dcterms:created "2023-01-01"^^xsd:dateTime')
      expect(sparqlCall.body).toContain('dcterms:modified "2023-01-02"^^xsd:dateTime')
    })
  })

  describe('when supplying partial fields', () => {
    test('should only update provided fields', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      })

      const params = {
        graphId: 'test-graph',
        versionType: 'DRAFT'
      }

      await updateVersionMetadata(params)

      const sparqlCall = sparqlRequest.mock.calls[0][0]
      expect(sparqlCall.body).toContain('gcmd:versionType "DRAFT"')
      expect(sparqlCall.body).not.toContain('gcmd:versionName')
      expect(sparqlCall.body).not.toContain('dcterms:created')
      expect(sparqlCall.body).not.toContain('dcterms:modified')
    })
  })

  describe('when errors occur', () => {
    it('should handle errors when updating version metadata', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('SPARQL update failed')
      })

      const params = {
        graphId: 'test-graph',
        version: '1.0'
      }

      await expect(updateVersionMetadata(params)).rejects.toThrow('SPARQL update failed')
    })

    it('should handle network errors', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      const params = {
        graphId: 'test-graph',
        version: '1.0'
      }

      await expect(updateVersionMetadata(params)).rejects.toThrow('Network error')
    })
  })
})
