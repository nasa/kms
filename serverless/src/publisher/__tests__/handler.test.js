import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { CsvComparator } from '@/shared/csvComparator'
import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { logger } from '@/shared/logger'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import {
  createKeywordEvents,
  getKeywordChanges,
  publisher
} from '../handler'

const { sendEventBridgeMock, PutEventsCommandMock } = vi.hoisted(() => ({
  sendEventBridgeMock: vi.fn(),
  PutEventsCommandMock: vi.fn((input) => input)
}))

// Mock the imported functions
vi.mock('@/shared/csvComparator')
vi.mock('@/shared/downloadConcepts')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/operations/updates/getPublishUpdateQuery')
vi.mock('@/shared/sparqlRequest')
vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(() => ({
    send: sendEventBridgeMock
  })),
  PutEventsCommand: PutEventsCommandMock
}))

describe('publisher handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 0 })
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(logger, 'debug').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
  })

  describe('createKeywordEvents', () => {
    test('should create INSERTED events for added keywords', () => {
      const keywordChangesMap = new Map([
        ['sciencekeywords', {
          addedKeywords: new Map([
            ['uuid1', {
              oldPath: undefined,
              newPath: 'EARTH SCIENCE > ATMOSPHERE'
            }]
          ]),
          removedKeywords: new Map(),
          changedKeywords: new Map()
        }]
      ])

      const events = createKeywordEvents(keywordChangesMap)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        EventType: 'INSERTED',
        Scheme: 'sciencekeywords',
        UUID: 'uuid1',
        NewKeywordPath: 'EARTH SCIENCE > ATMOSPHERE',
        MetadataSpecification: {
          URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
          Name: 'Kms-Keyword-Event',
          Version: '1.0'
        }
      })

      expect(events[0].Timestamp).toBeDefined()
    })

    test('should create DELETED events for removed keywords', () => {
      const keywordChangesMap = new Map([
        ['platforms', {
          addedKeywords: new Map(),
          removedKeywords: new Map([
            ['uuid2', {
              oldPath: 'OLD PATH',
              newPath: undefined
            }]
          ]),
          changedKeywords: new Map()
        }]
      ])

      const events = createKeywordEvents(keywordChangesMap)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        EventType: 'DELETED',
        Scheme: 'platforms',
        UUID: 'uuid2',
        OldKeywordPath: 'OLD PATH'
      })

      expect(events[0].NewKeywordPath).toBeUndefined()
    })

    test('should create UPDATED events for changed keywords', () => {
      const keywordChangesMap = new Map([
        ['instruments', {
          addedKeywords: new Map(),
          removedKeywords: new Map(),
          changedKeywords: new Map([
            ['uuid3', {
              oldPath: 'OLD PATH',
              newPath: 'NEW PATH'
            }]
          ])
        }]
      ])

      const events = createKeywordEvents(keywordChangesMap)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        EventType: 'UPDATED',
        Scheme: 'instruments',
        UUID: 'uuid3',
        OldKeywordPath: 'OLD PATH',
        NewKeywordPath: 'NEW PATH'
      })
    })

    test('should create multiple events for multiple schemes', () => {
      const keywordChangesMap = new Map([
        ['sciencekeywords', {
          addedKeywords: new Map([['uuid1', {
            oldPath: undefined,
            newPath: 'PATH1'
          }]]),
          removedKeywords: new Map(),
          changedKeywords: new Map()
        }],
        ['platforms', {
          addedKeywords: new Map(),
          removedKeywords: new Map([['uuid2', {
            oldPath: 'PATH2',
            newPath: undefined
          }]]),
          changedKeywords: new Map()
        }]
      ])

      const events = createKeywordEvents(keywordChangesMap)

      expect(events).toHaveLength(2)
      expect(events[0].Scheme).toBe('sciencekeywords')
      expect(events[1].Scheme).toBe('platforms')
    })

    test('should handle empty keyword changes', () => {
      const keywordChangesMap = new Map()

      const events = createKeywordEvents(keywordChangesMap)

      expect(events).toHaveLength(0)
    })
  })

  describe('getKeywordChanges', () => {
    test('should fetch and compare concept schemes', async () => {
      const mockSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts.mockResolvedValue('csv content')

      const mockComparison = {
        addedKeywords: new Map(),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      const result = await getKeywordChanges()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(getConceptSchemeDetails).toHaveBeenCalledWith({ version: 'published' })
      expect(downloadConcepts).toHaveBeenCalledTimes(4) // 2 schemes × 2 versions
    })

    test('should return empty map when no concept schemes found', async () => {
      getConceptSchemeDetails.mockResolvedValue([])

      const result = await getKeywordChanges()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
      expect(logger.warn).toHaveBeenCalledWith('No concept schemes found')
    })

    test('should handle null concept schemes', async () => {
      getConceptSchemeDetails.mockResolvedValue(null)

      const result = await getKeywordChanges()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    test('should handle failed scheme processing', async () => {
      const mockSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts
        .mockResolvedValueOnce('csv content')
        .mockRejectedValueOnce(new Error('Download failed'))

      const mockComparison = {
        addedKeywords: new Map(),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      const result = await getKeywordChanges()

      // Should only have the successful scheme
      expect(result.size).toBeLessThanOrEqual(2)
    })

    test('should skip comparison when draft scheme does not exist', async () => {
      const mockSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'deletedscheme' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)

      // Mock downloadConcepts with implementation that checks parameters
      downloadConcepts.mockImplementation(({ conceptScheme, version }) => {
        if (conceptScheme === 'sciencekeywords') {
          return Promise.resolve('csv content for sciencekeywords')
        }

        if (conceptScheme === 'deletedscheme') {
          if (version === 'published') {
            return Promise.resolve('published csv content')
          }

          if (version === 'draft') {
            return Promise.reject(Object.assign(
              new Error('Failed to download CSV. Status: 404 - Invalid concept scheme parameter. Concept scheme not found'),
              {
                statusCode: 404,
                isSchemeNotFound: true
              }
            ))
          }
        }

        return Promise.reject(new Error('Unexpected call'))
      })

      const mockComparison = {
        addedKeywords: new Map(),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      const result = await getKeywordChanges()

      // Should only have the first scheme that succeeded
      expect(result.size).toBe(1)
      expect(result.has('sciencekeywords')).toBe(true)
      expect(result.has('deletedscheme')).toBe(false)

      // Verify appropriate logging
      expect(logger.info).toHaveBeenCalledWith(
        'Skipping deletedscheme: scheme does not exist in draft version (may have been renamed or deleted)'
      )
    })

    test('should skip comparison with warning when draft download fails with other error', async () => {
      const mockSchemes = [
        { notation: 'sciencekeywords' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)

      downloadConcepts.mockImplementation(({ version }) => {
        if (version === 'published') {
          return Promise.resolve('published csv content')
        }

        if (version === 'draft') {
          return Promise.reject(new Error('Network timeout'))
        }

        return Promise.reject(new Error('Unexpected call'))
      })

      const result = await getKeywordChanges()

      // Should have no schemes due to the error
      expect(result.size).toBe(0)

      // Verify warning log was called
      expect(logger.warn).toHaveBeenCalledWith(
        'Skipping sciencekeywords: error downloading draft version - Network timeout'
      )
    })

    test('should handle multiple schemes with mixed success and scheme not found', async () => {
      const mockSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'deletedscheme' },
        { notation: 'platforms' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)

      downloadConcepts.mockImplementation(({ conceptScheme, version }) => {
        if (conceptScheme === 'sciencekeywords') {
          return Promise.resolve('csv content for sciencekeywords')
        }

        if (conceptScheme === 'deletedscheme') {
          if (version === 'published') {
            return Promise.resolve('published csv content')
          }

          if (version === 'draft') {
            return Promise.reject(Object.assign(
              new Error('Failed to download CSV. Status: 404 - Invalid concept scheme parameter. Concept scheme not found'),
              {
                statusCode: 404,
                isSchemeNotFound: true
              }
            ))
          }
        }

        if (conceptScheme === 'platforms') {
          return Promise.resolve('csv content for platforms')
        }

        return Promise.reject(new Error('Unexpected call'))
      })

      const mockComparison = {
        addedKeywords: new Map(),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      const result = await getKeywordChanges()

      // Should only have the two successful schemes
      expect(result.size).toBe(2)
      expect(result.has('sciencekeywords')).toBe(true)
      expect(result.has('platforms')).toBe(true)
      expect(result.has('deletedscheme')).toBe(false)

      // Verify CSV comparator was called only for successful schemes
      expect(mockComparator.compare).toHaveBeenCalledTimes(2)
    })
  })

  describe('publisher', () => {
    const mockEvent = {
      detail: {
        versionName: 'v1.0.0',
        publishDate: '2023-06-01T12:00:00.000Z'
      }
    }

    beforeEach(() => {
      getPublishUpdateQuery.mockReturnValue('mock query')
      sparqlRequest.mockResolvedValue({ ok: true })
    })

    test('should successfully process publish event', async () => {
      const mockSchemes = [{ notation: 'sciencekeywords' }]
      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts.mockResolvedValue('csv content')

      const mockComparison = {
        addedKeywords: new Map([['uuid1', {
          oldPath: undefined,
          newPath: 'PATH'
        }]]),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 1,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      await publisher(mockEvent)

      expect(logger.info).toHaveBeenCalledWith('[publisher] Starting analysis for version=v1.0.0')
      expect(getPublishUpdateQuery).toHaveBeenCalledWith('v1.0.0', expect.any(String))
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        body: 'mock query'
      })

      expect(logger.info).toHaveBeenCalledWith('[publisher] Publish update completed for version=v1.0.0')
      expect(sendEventBridgeMock).toHaveBeenCalledTimes(1)
    })

    test('should emit publisher event with keyword events', async () => {
      const mockSchemes = [{ notation: 'sciencekeywords' }]
      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts.mockResolvedValue('csv content')

      const mockComparison = {
        addedKeywords: new Map([['uuid1', {
          oldPath: undefined,
          newPath: 'PATH'
        }]]),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 1,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      await publisher(mockEvent)

      expect(PutEventsCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Entries: expect.arrayContaining([
            expect.objectContaining({
              Source: 'kms.publisher',
              DetailType: 'kms.publisher.analysis.completed',
              Detail: expect.stringContaining('v1.0.0')
            })
          ])
        })
      )

      const detailString = PutEventsCommandMock.mock.calls[0][0].Entries[0].Detail
      const detail = JSON.parse(detailString)
      expect(detail.keywordEvents).toHaveLength(1)
      expect(detail.totalEvents).toBe(1)
    })

    test('should throw error when SPARQL update fails', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(publisher(mockEvent)).rejects.toThrow('Failed to execute publish update: 500 Internal Server Error')

      expect(logger.error).toHaveBeenCalledWith(
        '[publisher] Error in publisher handler:',
        expect.stringContaining('Failed to execute publish update')
      )
    })

    test('should throw error when EventBridge emit fails', async () => {
      const mockSchemes = [{ notation: 'sciencekeywords' }]
      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts.mockResolvedValue('csv content')

      const mockComparison = {
        addedKeywords: new Map(),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 1 })

      await expect(publisher(mockEvent)).rejects.toThrow('Failed to emit publisher event')

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[publisher] Failed to emit cache-prime event error=')
      )
    })

    test('should throw error when versionName is missing', async () => {
      const invalidEvent = { detail: {} }

      await expect(publisher(invalidEvent)).rejects.toThrow('versionName is required in event.detail')

      expect(logger.error).toHaveBeenCalledWith(
        '[publisher] Error in publisher handler:',
        'versionName is required in event.detail'
      )
    })

    test('should throw error when publishDate is missing', async () => {
      const invalidEvent = { detail: { versionName: 'v1.0.0' } }

      await expect(publisher(invalidEvent)).rejects.toThrow('publishDate is required in event.detail')

      expect(logger.error).toHaveBeenCalledWith(
        '[publisher] Error in publisher handler:',
        'publishDate is required in event.detail'
      )
    })
  })
})
