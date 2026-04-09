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
import { publishKeywordEvent } from '@/shared/publishKeywordEvent'
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

const waitForCondition = async (assertion, attempts = 20) => {
  try {
    assertion()

    return undefined
  } catch (error) {
    if (attempts <= 1) {
      throw error
    }

    await Promise.resolve()

    return waitForCondition(assertion, attempts - 1)
  }
}

// Mock the imported functions
vi.mock('@/shared/csvComparator')
vi.mock('@/shared/downloadConcepts')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/operations/updates/getPublishUpdateQuery')
vi.mock('@/shared/publishKeywordEvent')
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
    publishKeywordEvent.mockResolvedValue({
      messageId: 'message-1',
      message: '{}',
      topicArn: 'arn:aws:sns:us-east-1:123456789012:keyword-events'
    })

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
      expect(getConceptSchemeDetails).toHaveBeenCalledWith({ version: 'draft' })
      expect(downloadConcepts).toHaveBeenCalledTimes(4) // 2 schemes × 2 versions
    })

    test('should process concept schemes sequentially', async () => {
      const mockSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)

      const pendingResolvers = []
      downloadConcepts.mockImplementation(({ conceptScheme, version }) => new Promise((resolve) => {
        pendingResolvers.push({
          conceptScheme,
          version,
          resolve
        })
      }))

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

      const resultPromise = getKeywordChanges()

      await waitForCondition(() => {
        expect(downloadConcepts).toHaveBeenCalledTimes(2)
      })

      expect(downloadConcepts).toHaveBeenNthCalledWith(1, {
        conceptScheme: 'sciencekeywords',
        format: 'csv',
        version: 'published'
      })

      expect(downloadConcepts).toHaveBeenNthCalledWith(2, {
        conceptScheme: 'sciencekeywords',
        format: 'csv',
        version: 'draft'
      })

      pendingResolvers.splice(0).forEach(({ resolve }) => resolve('csv content'))

      await waitForCondition(() => {
        expect(downloadConcepts).toHaveBeenCalledTimes(4)
      })

      expect(downloadConcepts).toHaveBeenNthCalledWith(3, {
        conceptScheme: 'platforms',
        format: 'csv',
        version: 'published'
      })

      expect(downloadConcepts).toHaveBeenNthCalledWith(4, {
        conceptScheme: 'platforms',
        format: 'csv',
        version: 'draft'
      })

      pendingResolvers.splice(0).forEach(({ resolve }) => resolve('csv content'))

      const result = await resultPromise

      expect(result.size).toBe(2)
    })

    test('should return empty map when no concept schemes found', async () => {
      getConceptSchemeDetails.mockResolvedValue([])

      const result = await getKeywordChanges()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
      expect(logger.warn).toHaveBeenCalledWith('No concept schemes found in either version')
    })

    test('should handle null concept schemes', async () => {
      getConceptSchemeDetails.mockResolvedValue(null)

      const result = await getKeywordChanges()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    test('should fail keyword change detection when any scheme exhausts retries', async () => {
      vi.useFakeTimers()

      const mockSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)

      let callCount = 0
      downloadConcepts.mockImplementation(() => {
        callCount += 1
        if (callCount <= 2) {
          return Promise.resolve('csv content')
        }

        return Promise.reject(new Error('Download failed'))
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

      const resultPromise = getKeywordChanges()
      const expectation = expect(resultPromise).rejects.toThrow(
        'Keyword changes detection failed for 1 scheme(s): platforms: Download failed'
      )

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync()

      await expectation

      vi.useRealTimers()
    })

    test('should retry failed scheme downloads up to 4 times before giving up', async () => {
      vi.useFakeTimers()

      const mockSchemes = [
        { notation: 'sciencekeywords' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)

      let attemptCount = 0
      downloadConcepts.mockImplementation(() => {
        attemptCount += 1

        return Promise.reject(new Error('Download failed'))
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

      const resultPromise = getKeywordChanges()
      const expectation = expect(resultPromise).rejects.toThrow(
        'Keyword changes detection failed for 1 scheme(s): sciencekeywords: Download failed'
      )

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync()

      // Should have retried 4 times total (initial + 3 retries)
      expect(attemptCount).toBe(8) // 4 attempts × 2 downloads (published + draft)

      await expectation
      expect(logger.error).toHaveBeenCalledWith(
        'Failed sciencekeywords: exhausted all 4 attempts - Download failed'
      )

      vi.useRealTimers()
    })

    test('should succeed on retry if download succeeds on second attempt', async () => {
      vi.useFakeTimers()

      const mockSchemes = [
        { notation: 'sciencekeywords' }
      ]

      getConceptSchemeDetails.mockResolvedValue(mockSchemes)

      let attemptCount = 0
      downloadConcepts.mockImplementation(() => {
        attemptCount += 1
        // Fail first attempt, succeed on retry
        if (attemptCount === 1 || attemptCount === 2) {
          return Promise.reject(new Error('Download failed'))
        }

        return Promise.resolve('csv content')
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

      const resultPromise = getKeywordChanges()

      // Fast-forward through retry delay
      await vi.runAllTimersAsync()

      const result = await resultPromise

      // Should have succeeded after retry
      expect(result.size).toBe(1)
      expect(result.has('sciencekeywords')).toBe(true)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retrying sciencekeywords (attempt 2/4)')
      )

      vi.useRealTimers()
    })

    test('should create DELETED events when draft scheme does not exist', async () => {
      const mockPublishedSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'deletedscheme' }
      ]

      const mockDraftSchemes = [
        { notation: 'sciencekeywords' }
        // Deletedscheme is not in draft
      ]

      getConceptSchemeDetails
        .mockResolvedValueOnce(mockPublishedSchemes) // First call for published
        .mockResolvedValueOnce(mockDraftSchemes) // Second call for draft

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

      const mockComparator = {
        compare: vi.fn((published, draft) => {
          if (published === 'csv content for sciencekeywords' && draft === 'csv content for sciencekeywords') {
            return {
              addedKeywords: new Map(),
              removedKeywords: new Map(),
              changedKeywords: new Map()
            }
          }

          if (published === 'published csv content' && draft === '') {
            return {
              addedKeywords: new Map(),
              removedKeywords: new Map([['uuid-deleted', {
                oldPath: 'OLD PATH',
                newPath: undefined
              }]]),
              changedKeywords: new Map()
            }
          }

          return {
            addedKeywords: new Map(),
            removedKeywords: new Map(),
            changedKeywords: new Map()
          }
        }),
        getSummary: vi.fn((comparison) => ({
          addedCount: comparison.addedKeywords.size,
          removedCount: comparison.removedKeywords.size,
          changedCount: comparison.changedKeywords.size
        }))
      }

      CsvComparator.mockImplementation(() => mockComparator)

      const result = await getKeywordChanges()

      // Should have both schemes - deletedscheme now creates DELETED events
      expect(result.size).toBe(2)
      expect(result.has('sciencekeywords')).toBe(true)
      expect(result.has('deletedscheme')).toBe(true)

      // Verify deletedscheme has removed keywords
      expect(result.get('deletedscheme').removedKeywords.size).toBe(1)

      // Verify appropriate logging
      expect(logger.info).toHaveBeenCalledWith(
        'Scheme deletedscheme does not exist in draft version (removed or renamed). All keywords will be marked as DELETED.'
      )

      // Verify compare was called with empty string for deletedscheme
      expect(mockComparator.compare).toHaveBeenCalledWith('published csv content', '')
    })

    test('should skip comparison with warning when download fails with other error', async () => {
      vi.useFakeTimers()

      const mockPublishedSchemes = [
        { notation: 'sciencekeywords' }
      ]

      const mockDraftSchemes = [
        { notation: 'sciencekeywords' }
      ]

      getConceptSchemeDetails
        .mockResolvedValueOnce(mockPublishedSchemes)
        .mockResolvedValueOnce(mockDraftSchemes)

      downloadConcepts.mockRejectedValue(new Error('Network timeout'))

      const resultPromise = getKeywordChanges()
      const expectation = expect(resultPromise).rejects.toThrow(
        'Keyword changes detection failed for 1 scheme(s): sciencekeywords: Network timeout'
      )

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync()

      await expectation

      expect(logger.error).toHaveBeenCalledWith(
        'Failed sciencekeywords: exhausted all 4 attempts - Network timeout'
      )

      vi.useRealTimers()
    })

    test('should handle multiple schemes with mixed success and scheme not found', async () => {
      const mockPublishedSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'deletedscheme' },
        { notation: 'platforms' }
      ]

      const mockDraftSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
        // Deletedscheme is not in draft
      ]

      getConceptSchemeDetails
        .mockResolvedValueOnce(mockPublishedSchemes)
        .mockResolvedValueOnce(mockDraftSchemes)

      downloadConcepts.mockImplementation(({ conceptScheme }) => {
        if (conceptScheme === 'sciencekeywords') {
          return Promise.resolve('csv content for sciencekeywords')
        }

        if (conceptScheme === 'deletedscheme') {
          return Promise.resolve('published csv content')
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

      // Should have all three schemes - deletedscheme now creates DELETED events
      expect(result.size).toBe(3)
      expect(result.has('sciencekeywords')).toBe(true)
      expect(result.has('platforms')).toBe(true)
      expect(result.has('deletedscheme')).toBe(true)

      // Verify CSV comparator was called for all three schemes (including deletedscheme with empty string)
      expect(mockComparator.compare).toHaveBeenCalledTimes(3)
    })

    test('should create INSERTED events when scheme only exists in draft', async () => {
      const mockPublishedSchemes = [
        { notation: 'sciencekeywords' }
      ]

      const mockDraftSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'newscheme' }
        // Newscheme is only in draft
      ]

      getConceptSchemeDetails
        .mockResolvedValueOnce(mockPublishedSchemes)
        .mockResolvedValueOnce(mockDraftSchemes)

      downloadConcepts.mockImplementation(({ conceptScheme }) => {
        if (conceptScheme === 'sciencekeywords') {
          return Promise.resolve('csv content for sciencekeywords')
        }

        if (conceptScheme === 'newscheme') {
          return Promise.resolve('draft csv content for newscheme')
        }

        return Promise.reject(new Error('Unexpected call'))
      })

      const mockComparator = {
        compare: vi.fn((published, draft) => {
          if (published === 'csv content for sciencekeywords' && draft === 'csv content for sciencekeywords') {
            return {
              addedKeywords: new Map(),
              removedKeywords: new Map(),
              changedKeywords: new Map()
            }
          }

          if (published === '' && draft === 'draft csv content for newscheme') {
            return {
              addedKeywords: new Map([['uuid-new', {
                oldPath: undefined,
                newPath: 'NEW PATH'
              }]]),
              removedKeywords: new Map(),
              changedKeywords: new Map()
            }
          }

          return {
            addedKeywords: new Map(),
            removedKeywords: new Map(),
            changedKeywords: new Map()
          }
        }),
        getSummary: vi.fn((comparison) => ({
          addedCount: comparison.addedKeywords.size,
          removedCount: comparison.removedKeywords.size,
          changedCount: comparison.changedKeywords.size
        }))
      }

      CsvComparator.mockImplementation(() => mockComparator)

      const result = await getKeywordChanges()

      // Should have both schemes
      expect(result.size).toBe(2)
      expect(result.has('sciencekeywords')).toBe(true)
      expect(result.has('newscheme')).toBe(true)

      // Verify newscheme has added keywords
      expect(result.get('newscheme').addedKeywords.size).toBe(1)

      // Verify appropriate logging
      expect(logger.info).toHaveBeenCalledWith(
        'Scheme newscheme is new in draft version. All keywords will be marked as INSERTED.'
      )

      // Verify compare was called with empty string for newscheme published
      expect(mockComparator.compare).toHaveBeenCalledWith('', 'draft csv content for newscheme')
    })

    test('should handle schemes only in published, only in draft, and in both', async () => {
      const mockPublishedSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'deletedscheme' }
      ]

      const mockDraftSchemes = [
        { notation: 'sciencekeywords' },
        { notation: 'newscheme' }
      ]

      getConceptSchemeDetails
        .mockResolvedValueOnce(mockPublishedSchemes)
        .mockResolvedValueOnce(mockDraftSchemes)

      downloadConcepts.mockImplementation(({ conceptScheme }) => Promise.resolve(`csv content for ${conceptScheme}`))

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

      // Should have all three schemes
      expect(result.size).toBe(3)
      expect(result.has('sciencekeywords')).toBe(true)
      expect(result.has('deletedscheme')).toBe(true)
      expect(result.has('newscheme')).toBe(true)

      // Verify comparator was called 3 times
      expect(mockComparator.compare).toHaveBeenCalledTimes(3)

      // Verify appropriate logs for each case
      expect(logger.info).toHaveBeenCalledWith(
        'Scheme deletedscheme does not exist in draft version (removed or renamed). All keywords will be marked as DELETED.'
      )

      expect(logger.info).toHaveBeenCalledWith(
        'Scheme newscheme is new in draft version. All keywords will be marked as INSERTED.'
      )
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

      const result = await publisher(mockEvent)

      expect(logger.info).toHaveBeenCalledWith('[publisher] Starting analysis for version=v1.0.0')
      expect(getPublishUpdateQuery).toHaveBeenCalledWith('v1.0.0', expect.any(String))
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        body: 'mock query'
      })

      expect(logger.info).toHaveBeenCalledWith('[publisher] Publish update completed for version=v1.0.0')
      expect(publishKeywordEvent).toHaveBeenCalledTimes(1)
      expect(publishKeywordEvent).toHaveBeenCalledWith(expect.objectContaining({
        EventType: 'INSERTED',
        Scheme: 'sciencekeywords',
        UUID: 'uuid1',
        NewKeywordPath: 'PATH'
      }))

      expect(sendEventBridgeMock).toHaveBeenCalledTimes(1)

      expect(result).toEqual({
        status: 'success',
        versionName: 'v1.0.0',
        publishDate: mockEvent.detail.publishDate,
        published: true,
        keywordEventsPublished: 1,
        cachePrimeEventEmitted: true,
        keywordEventsCount: 1,
        warnings: []
      })
    })

    test('should fail the invocation before publish when keyword change generation fails', async () => {
      getConceptSchemeDetails.mockRejectedValue(new Error('Scheme lookup failed'))

      await expect(publisher(mockEvent)).rejects.toThrow('Scheme lookup failed')

      expect(sparqlRequest).not.toHaveBeenCalled()
      expect(publishKeywordEvent).not.toHaveBeenCalled()
      expect(sendEventBridgeMock).not.toHaveBeenCalled()
    })

    test('should complete successfully without SNS publish when no keyword events are generated', async () => {
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

      const result = await publisher(mockEvent)

      expect(sparqlRequest).toHaveBeenCalledTimes(1)
      expect(publishKeywordEvent).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('[publisher] No keyword events generated, skipping SNS publish')
      expect(result).toEqual({
        status: 'success',
        versionName: 'v1.0.0',
        publishDate: mockEvent.detail.publishDate,
        published: true,
        keywordEventsPublished: 0,
        cachePrimeEventEmitted: true,
        keywordEventsCount: 0,
        warnings: []
      })
    })

    test('should not publish keyword events when the SPARQL publish update fails', async () => {
      const mockSchemes = [{ notation: 'sciencekeywords' }]
      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts.mockResolvedValue('csv content')

      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

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

      await expect(publisher(mockEvent)).rejects.toThrow(
        'Failed to execute publish update: 500 Internal Server Error'
      )

      expect(publishKeywordEvent).not.toHaveBeenCalled()
      expect(sendEventBridgeMock).not.toHaveBeenCalled()
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

      const result = await publisher(mockEvent)

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
      expect(publishKeywordEvent).toHaveBeenCalledTimes(1)

      expect(result.status).toBe('success')
      expect(result.cachePrimeEventEmitted).toBe(true)
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

    test('should return partial_success when EventBridge emit fails', async () => {
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

      const result = await publisher(mockEvent)

      expect(publishKeywordEvent).not.toHaveBeenCalled()
      expect(result).toEqual({
        status: 'partial_success',
        versionName: 'v1.0.0',
        publishDate: mockEvent.detail.publishDate,
        published: true,
        keywordEventsPublished: 0,
        cachePrimeEventEmitted: false,
        keywordEventsCount: 0,
        warnings: ['Publish completed, but failed to emit cache-prime event']
      })

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[publisher] Publish completed, but failed to emit cache-prime event')
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

    test('should create keyword events before the SPARQL publish and publish them to SNS only after publish succeeds', async () => {
      const mockSchemes = [{ notation: 'sciencekeywords' }]
      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts.mockResolvedValue('csv content')

      const callOrder = []
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
      getPublishUpdateQuery.mockImplementation(() => {
        callOrder.push('build-publish-query')

        return 'mock query'
      })

      sparqlRequest.mockImplementation(async () => {
        callOrder.push('execute-publish')

        return { ok: true }
      })

      publishKeywordEvent.mockImplementation(async () => {
        callOrder.push('publish-keyword-event')

        return {
          messageId: 'message-1',
          message: '{}',
          topicArn: 'arn:aws:sns:us-east-1:123456789012:keyword-events'
        }
      })

      await publisher(mockEvent)

      expect(logger.info).toHaveBeenCalledWith('[publisher] Created 1 keyword events')
      expect(callOrder).toEqual([
        'build-publish-query',
        'execute-publish',
        'publish-keyword-event'
      ])
    })

    test('should return partial_success when SNS publish retries are exhausted and continue with remaining events', async () => {
      const mockSchemes = [{ notation: 'sciencekeywords' }]
      getConceptSchemeDetails.mockResolvedValue(mockSchemes)
      downloadConcepts.mockResolvedValue('csv content')

      const mockComparison = {
        addedKeywords: new Map([
          ['uuid1', {
            oldPath: undefined,
            newPath: 'PATH 1'
          }],
          ['uuid2', {
            oldPath: undefined,
            newPath: 'PATH 2'
          }]
        ]),
        removedKeywords: new Map(),
        changedKeywords: new Map()
      }

      const mockComparator = {
        compare: vi.fn().mockReturnValue(mockComparison),
        getSummary: vi.fn().mockReturnValue({
          addedCount: 2,
          removedCount: 0,
          changedCount: 0
        })
      }

      CsvComparator.mockImplementation(() => mockComparator)

      publishKeywordEvent
        .mockRejectedValueOnce(new Error('SNS unavailable'))
        .mockRejectedValueOnce(new Error('SNS unavailable'))
        .mockRejectedValueOnce(new Error('SNS unavailable'))
        .mockRejectedValueOnce(new Error('SNS unavailable'))
        .mockResolvedValueOnce({
          messageId: 'message-2',
          message: '{}',
          topicArn: 'arn:aws:sns:us-east-1:123456789012:keyword-events'
        })

      const result = await publisher(mockEvent)

      expect(publishKeywordEvent).toHaveBeenCalledTimes(5)
      expect(publishKeywordEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ UUID: 'uuid1' }))
      expect(publishKeywordEvent).toHaveBeenNthCalledWith(5, expect.objectContaining({ UUID: 'uuid2' }))
      expect(sendEventBridgeMock).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        status: 'partial_success',
        versionName: 'v1.0.0',
        publishDate: mockEvent.detail.publishDate,
        published: true,
        keywordEventsPublished: 1,
        cachePrimeEventEmitted: true,
        keywordEventsCount: 2,
        warnings: ['Publish completed, but 1 keyword event publishes failed after retries']
      })
    })

    test('should not publish keyword events to SNS when the SPARQL publish update fails', async () => {
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
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(publisher(mockEvent)).rejects.toThrow('Failed to execute publish update: 500 Internal Server Error')

      expect(publishKeywordEvent).not.toHaveBeenCalled()
      expect(sendEventBridgeMock).not.toHaveBeenCalled()
    })
  })
})
