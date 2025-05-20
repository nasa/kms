import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { getResourceValues } from '@/shared/getResourceValues'
import { getCreateRelationshipQuery } from '@/shared/operations/queries/getCreateRelationshipQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { ensureReciprocalRelations } from '../ensureReciprocalRelations'

// Mock dependencies
vi.mock('@/shared/getResourceValues')
vi.mock('@/shared/operations/queries/getCreateRelationshipQuery')
vi.mock('@/shared/sparqlRequest')

describe('ensureReciprocalRelations', () => {
  const mockParams = {
    rdfXml: '<rdf>mock xml</rdf>',
    conceptId: 'mock-uuid',
    version: 'v1',
    transactionUrl: 'http://example.com/transaction'
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('When processing relations', () => {
    it('should create reciprocal relationships for all relation types', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept1'])
      getCreateRelationshipQuery.mockReturnValue('MOCK SPARQL QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalRelations(mockParams)

      expect(getResourceValues).toHaveBeenCalledTimes(3)
      expect(getCreateRelationshipQuery).toHaveBeenCalledTimes(3)
      expect(sparqlRequest).toHaveBeenCalledTimes(3)
    })

    it('should skip relation types with no related concepts', async () => {
      getResourceValues.mockReturnValueOnce([])
        .mockReturnValueOnce(['http://example.com/concept1'])
        .mockReturnValueOnce([])

      getCreateRelationshipQuery.mockReturnValue('MOCK SPARQL QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalRelations(mockParams)

      expect(getResourceValues).toHaveBeenCalledTimes(3)
      expect(getCreateRelationshipQuery).toHaveBeenCalledTimes(1)
      expect(sparqlRequest).toHaveBeenCalledTimes(1)
    })
  })

  describe('When SPARQL request fails', () => {
    it('should throw an error', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept1'])
      getCreateRelationshipQuery.mockReturnValue('MOCK SPARQL QUERY')
      sparqlRequest.mockResolvedValue({ ok: false })

      await expect(ensureReciprocalRelations(mockParams)).rejects.toThrow('Failed to create reciprocal')
    })
  })

  describe('When processing different relation types', () => {
    it('should create correct reciprocal relationships', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept1'])
      getCreateRelationshipQuery.mockReturnValue('MOCK SPARQL QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalRelations(mockParams)

      expect(getCreateRelationshipQuery).toHaveBeenCalledWith(expect.objectContaining({
        relationship: 'skos:narrower'
      }))

      expect(getCreateRelationshipQuery).toHaveBeenCalledWith(expect.objectContaining({
        relationship: 'skos:broader'
      }))

      expect(getCreateRelationshipQuery).toHaveBeenCalledWith(expect.objectContaining({
        relationship: 'skos:related'
      }))
    })
  })
})
