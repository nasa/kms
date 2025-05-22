import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getResourceValues } from '@/shared/getResourceValues'
import { getDeleteRelationshipQuery } from '@/shared/operations/queries/getDeleteRelationshipQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { ensureReciprocalDeletions } from '../ensureReciprocalDeletions'

vi.mock('@/shared/getResourceValues')
vi.mock('@/shared/operations/queries/getDeleteRelationshipQuery')
vi.mock('@/shared/sparqlRequest')

const originalConsoleError = console.error
const originalConsoleLog = console.log

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.error = originalConsoleError
  console.log = originalConsoleLog
})

describe('ensureReciprocalDeletions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('When called with valid parameters', () => {
    test('should process all relation types', async () => {
      // Setup
      const mockParams = {
        conceptId: 'testId',
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml',
        version: '1',
        transactionUrl: 'http://test.com'
      }

      getResourceValues
        .mockReturnValueOnce(['http://test.com/concept1']) // Old skos:broader
        .mockReturnValueOnce([]) // New skos:broader
        .mockReturnValueOnce(['http://test.com/concept2']) // Old skos:narrower
        .mockReturnValueOnce([]) // New skos:narrower
        .mockReturnValueOnce(['http://test.com/concept3']) // Old skos:related
        .mockReturnValueOnce([]) // New skos:related
        .mockReturnValueOnce(['http://test.com/instrument1']) // Old gcmd:hasInstrument
        .mockReturnValueOnce([]) // New gcmd:hasInstrument
        .mockReturnValueOnce(['http://test.com/platform1']) // Old gcmd:isOnPlatform
        .mockReturnValueOnce([]) // New gcmd:isOnPlatform
        .mockReturnValueOnce(['http://test.com/sensor1']) // Old gcmd:hasSensor
        .mockReturnValueOnce([]) // New gcmd:hasSensor

      getDeleteRelationshipQuery.mockReturnValue('DELETE QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      // Execute
      const result = await ensureReciprocalDeletions(mockParams)

      // Assert
      expect(result).toEqual({ ok: true })
      expect(getResourceValues).toHaveBeenCalledTimes(12) // 6 relation types * 2 (old and new)
      expect(getDeleteRelationshipQuery).toHaveBeenCalledTimes(6) // 6 relation types
      expect(sparqlRequest).toHaveBeenCalledTimes(6) // 6 relation types

      // Additional assertions to ensure correct parameters are passed
      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['concept1'],
        relationship: 'skos:broader',
        inverseRelationship: 'skos:narrower'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['concept2'],
        relationship: 'skos:narrower',
        inverseRelationship: 'skos:broader'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['concept3'],
        relationship: 'skos:related',
        inverseRelationship: 'skos:related'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['instrument1'],
        relationship: 'gcmd:hasInstrument',
        inverseRelationship: 'gcmd:isOnPlatform'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['platform1'],
        relationship: 'gcmd:isOnPlatform',
        inverseRelationship: 'gcmd:hasInstrument'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['sensor1'],
        relationship: 'gcmd:hasSensor',
        inverseRelationship: 'gcmd:isOnPlatform'
      })
    })

    test('should handle case when no relations are removed', async () => {
      // Setup
      const mockParams = {
        conceptId: 'testId',
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml',
        version: '1',
        transactionUrl: 'http://test.com'
      }

      getResourceValues.mockReturnValue([])

      // Execute
      const result = await ensureReciprocalDeletions(mockParams)

      // Assert
      expect(result).toEqual({ ok: true })
      expect(getDeleteRelationshipQuery).not.toHaveBeenCalled()
      expect(sparqlRequest).not.toHaveBeenCalled()
    })
  })

  describe('When sparqlRequest fails', () => {
    test('should throw an error', async () => {
      // Setup
      const mockParams = {
        conceptId: 'testId',
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml',
        version: '1',
        transactionUrl: 'http://test.com'
      }

      getResourceValues.mockReturnValueOnce(['http://test.com/concept1']).mockReturnValueOnce([])
      getDeleteRelationshipQuery.mockReturnValue('DELETE QUERY')
      sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

      // Execute and Assert
      await expect(ensureReciprocalDeletions(mockParams)).rejects.toThrow('SPARQL request failed')
    })
  })

  describe('When newRdfXml is null', () => {
    test('should use an empty array for new related concepts', async () => {
      // Setup
      const mockParams = {
        conceptId: 'testId',
        oldRdfXml: 'oldXml',
        newRdfXml: null,
        version: '1',
        transactionUrl: 'http://test.com'
      }

      getResourceValues.mockReturnValueOnce(['http://test.com/concept1'])
        .mockReturnValue([])

      getDeleteRelationshipQuery.mockReturnValue('DELETE QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      // Execute
      const result = await ensureReciprocalDeletions(mockParams)

      // Assert
      expect(result).toEqual({ ok: true })
      expect(getResourceValues).toHaveBeenCalledWith('oldXml', expect.any(String))
      expect(getResourceValues).not.toHaveBeenCalledWith(null, expect.any(String))
      expect(getDeleteRelationshipQuery).toHaveBeenCalledTimes(1) // Only for the first relation type
      expect(sparqlRequest).toHaveBeenCalledTimes(1) // Only for the first relation type
    })
  })

  describe('When processing different relation types', () => {
    test('should handle all relation types correctly', async () => {
    // Setup
      const mockParams = {
        conceptId: 'testId',
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml',
        version: '1',
        transactionUrl: 'http://test.com'
      }

      getResourceValues
        .mockReturnValueOnce(['http://test.com/concept1']) // Old skos:broader
        .mockReturnValueOnce([]) // New skos:broader
        .mockReturnValueOnce(['http://test.com/concept2']) // Old skos:narrower
        .mockReturnValueOnce([]) // New skos:narrower
        .mockReturnValueOnce(['http://test.com/concept3']) // Old skos:related
        .mockReturnValueOnce([]) // New skos:related
        .mockReturnValueOnce(['http://test.com/instrument1']) // Old gcmd:hasInstrument
        .mockReturnValueOnce([]) // New gcmd:hasInstrument
        .mockReturnValueOnce(['http://test.com/platform1']) // Old gcmd:isOnPlatform
        .mockReturnValueOnce([]) // New gcmd:isOnPlatform
        .mockReturnValueOnce(['http://test.com/sensor1']) // Old gcmd:hasSensor
        .mockReturnValueOnce([]) // New gcmd:hasSensor

      getDeleteRelationshipQuery.mockReturnValue('DELETE QUERY')
      sparqlRequest.mockResolvedValue({ ok: true })

      // Execute
      const result = await ensureReciprocalDeletions(mockParams)

      // Assert
      expect(result).toEqual({ ok: true })
      expect(getDeleteRelationshipQuery).toHaveBeenCalledTimes(6)
      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['concept1'],
        relationship: 'skos:broader',
        inverseRelationship: 'skos:narrower'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['concept2'],
        relationship: 'skos:narrower',
        inverseRelationship: 'skos:broader'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['concept3'],
        relationship: 'skos:related',
        inverseRelationship: 'skos:related'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['instrument1'],
        relationship: 'gcmd:hasInstrument',
        inverseRelationship: 'gcmd:isOnPlatform'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['platform1'],
        relationship: 'gcmd:isOnPlatform',
        inverseRelationship: 'gcmd:hasInstrument'
      })

      expect(getDeleteRelationshipQuery).toHaveBeenCalledWith({
        sourceUuid: 'testId',
        targetUuids: ['sensor1'],
        relationship: 'gcmd:hasSensor',
        inverseRelationship: 'gcmd:isOnPlatform'
      })
    })
  })

  describe('When sparqlRequest fails', () => {
    test('should throw an error when response is not ok', async () => {
    // Setup
      const mockParams = {
        conceptId: 'testId',
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml',
        version: '1',
        transactionUrl: 'http://test.com'
      }

      getResourceValues.mockReturnValueOnce(['http://test.com/concept1']).mockReturnValueOnce([])
      getDeleteRelationshipQuery.mockReturnValue('DELETE QUERY')
      sparqlRequest.mockResolvedValue({ ok: false })

      // Execute and Assert
      await expect(ensureReciprocalDeletions(mockParams)).rejects.toThrow('Failed to delete reciprocal skos:narrower relationships')
    })

    test('should throw an error when sparqlRequest throws', async () => {
    // Setup
      const mockParams = {
        conceptId: 'testId',
        oldRdfXml: 'oldXml',
        newRdfXml: 'newXml',
        version: '1',
        transactionUrl: 'http://test.com'
      }

      getResourceValues.mockReturnValueOnce(['http://test.com/concept1']).mockReturnValueOnce([])
      getDeleteRelationshipQuery.mockReturnValue('DELETE QUERY')
      sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

      // Execute and Assert
      await expect(ensureReciprocalDeletions(mockParams)).rejects.toThrow('SPARQL request failed')
    })
  })
})
