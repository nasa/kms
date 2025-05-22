import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getResourceValues } from '@/shared/getResourceValues'
import { getCreateRelationshipQuery } from '@/shared/operations/queries/getCreateRelationshipQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { ensureReciprocalInsertions } from '../ensureReciprocalInsertions'

vi.mock('@/shared/getResourceValues')
vi.mock('@/shared/operations/queries/getCreateRelationshipQuery')
vi.mock('@/shared/sparqlRequest')

describe('ensureReciprocalInsertions', () => {
  const mockParams = {
    rdfXml: '<rdf:RDF></rdf:RDF>',
    conceptId: '123',
    version: '1',
    transactionUrl: 'http://example.com/transaction'
  }

  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('When called with valid parameters', () => {
    test('should return { ok: true } when successful', async () => {
      getResourceValues.mockReturnValue(['http://example.com/456'])
      getCreateRelationshipQuery.mockReturnValue('MOCK_QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await ensureReciprocalInsertions(mockParams)
      expect(result).toEqual({ ok: true })
    })

    test('should call sparqlRequest with correct parameters', async () => {
      getResourceValues.mockReturnValue(['http://example.com/456'])
      getCreateRelationshipQuery.mockReturnValue('MOCK_QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalInsertions(mockParams)
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'PUT',
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        body: 'MOCK_QUERY',
        version: '1',
        transaction: {
          transactionUrl: 'http://example.com/transaction',
          action: 'UPDATE'
        }
      })
    })
  })

  describe('When no relations are found in the RDF/XML', () => {
    test('should not call getCreateRelationshipQuery or sparqlRequest', async () => {
      getResourceValues.mockReturnValue([])

      await ensureReciprocalInsertions(mockParams)
      expect(getCreateRelationshipQuery).not.toHaveBeenCalled()
      expect(sparqlRequest).not.toHaveBeenCalled()
    })
  })

  describe('When sparqlRequest fails', () => {
    test('should throw an error', async () => {
      getResourceValues.mockReturnValue(['http://example.com/456'])
      getCreateRelationshipQuery.mockReturnValue('MOCK_QUERY')
      sparqlRequest.mockResolvedValue({ ok: false })

      await expect(ensureReciprocalInsertions(mockParams)).rejects.toThrow('Failed to create reciprocal skos:narrower relationships')
    })
  })

  describe('When an unexpected error occurs', () => {
    test('should throw the error', async () => {
      getResourceValues.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      await expect(ensureReciprocalInsertions(mockParams)).rejects.toThrow('Unexpected error')
    })
  })

  describe('When relation URIs have different formats', () => {
    test('should correctly extract UUIDs', async () => {
      getResourceValues.mockReturnValue([
        'http://example.com/456',
        'https://another-domain.org/concept/789',
        '/local-path/101'
      ])

      getCreateRelationshipQuery.mockReturnValue('MOCK_QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalInsertions(mockParams)

      expect(getCreateRelationshipQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUuids: ['456', '789', '101']
        })
      )
    })
  })

  describe('When getResourceValues returns null or empty array', () => {
    test('should skip creating relationships for that relation type', async () => {
    // Mock getResourceValues to return null, then an empty array, then a value
      getResourceValues
        .mockReturnValueOnce(null)
        .mockReturnValueOnce([])
        .mockReturnValue(['http://example.com/456'])

      getCreateRelationshipQuery.mockReturnValue('MOCK_QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalInsertions(mockParams)

      // Check that getCreateRelationshipQuery and sparqlRequest are called
      // only for the non-null, non-empty result
      expect(getCreateRelationshipQuery).toHaveBeenCalledTimes(4)
      expect(sparqlRequest).toHaveBeenCalledTimes(4)

      // Check that for the first two calls (null and empty array),
      // getCreateRelationshipQuery and sparqlRequest were not called
      expect(getCreateRelationshipQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({ relationship: 'skos:broader' })
      )

      expect(getCreateRelationshipQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({ relationship: 'skos:narrower' })
      )
    })
  })
})
