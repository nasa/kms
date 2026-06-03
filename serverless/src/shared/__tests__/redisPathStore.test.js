import { Readable } from 'stream'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcepts } from '@/getConcepts/handler'
import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'

import { createCsv } from '../createCsv'
import { createCsvMetadata } from '../createCsvMetadata'
import { generateCsvHeaders } from '../generateCsvHeaders'
import { getApplicationConfig } from '../getConfig'
import { getCsvHeaders } from '../getCsvHeaders'
import { getLongNamesMap } from '../getLongNamesMap'
import { getMaxLengthOfSubArray } from '../getMaxLengthOfSubArray'
import { getNarrowers } from '../getNarrowers'
import { getNarrowersMap } from '../getNarrowersMap'
import { getProviderUrlsMap } from '../getProviderUrlsMap'
import { getRootConceptForScheme } from '../getRootConceptForScheme'
import { isCsvLongNameFlag } from '../isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from '../isCsvProviderUrlFlag'
import {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} from '../redisCacheKeys'
import {
  clearCachedByPrefix,
  getCachedJsonResponse,
  getRedisClient
} from '../redisCacheStore'
import { RedisPathStore, redisPathStore } from '../redisPathStore'

vi.mock('../redisCacheStore', () => ({
  clearCachedByPrefix: vi.fn(),
  getCachedJsonResponse: vi.fn(),
  getRedisClient: vi.fn()
}))

vi.mock('@/shared/downloadConcepts', () => ({
  downloadConcepts: vi.fn()
}))

vi.mock('@/shared/getConceptSchemeDetails', () => ({
  getConceptSchemeDetails: vi.fn()
}))

vi.mock('../getConfig', () => ({
  getApplicationConfig: vi.fn()
}))

vi.mock('@/shared/getVersionMetadata', () => ({
  getVersionMetadata: vi.fn()
}))

vi.mock('../createCsv', () => ({
  createCsv: vi.fn()
}))

vi.mock('../createCsvMetadata', () => ({
  createCsvMetadata: vi.fn()
}))

vi.mock('../generateCsvHeaders', () => ({
  generateCsvHeaders: vi.fn()
}))

vi.mock('../getCsvHeaders', () => ({
  getCsvHeaders: vi.fn()
}))

vi.mock('../getLongNamesMap', () => ({
  getLongNamesMap: vi.fn()
}))

vi.mock('../getMaxLengthOfSubArray', () => ({
  getMaxLengthOfSubArray: vi.fn()
}))

vi.mock('../getNarrowers', () => ({
  getNarrowers: vi.fn()
}))

vi.mock('../getNarrowersMap', () => ({
  getNarrowersMap: vi.fn()
}))

vi.mock('../getProviderUrlsMap', () => ({
  getProviderUrlsMap: vi.fn()
}))

vi.mock('../getRootConceptForScheme', () => ({
  getRootConceptForScheme: vi.fn()
}))

vi.mock('../isCsvLongNameFlag', () => ({
  isCsvLongNameFlag: vi.fn()
}))

vi.mock('../isCsvProviderUrlFlag', () => ({
  isCsvProviderUrlFlag: vi.fn()
}))

vi.mock('@/getConcepts/handler', () => ({
  getConcepts: vi.fn()
}))

const createTestStore = ({
  send = vi.fn(),
  redisClient = {
    sAdd: vi.fn().mockResolvedValue(1),
    sMembers: vi.fn().mockResolvedValue([]),
    mSet: vi.fn().mockResolvedValue('OK')
  }
} = {}) => new RedisPathStore({
  s3ClientProvider: () => ({ send }),
  redisClientProvider: async () => redisClient
})

describe('redisPathStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.mocked(getApplicationConfig).mockReturnValue({ env: 'sit' })
    vi.mocked(getVersionMetadata).mockResolvedValue({ versionName: 'v22.1' })
  })

  afterEach(() => {
    delete process.env.RDF_BUCKET_NAME
  })

  test('creates a provider CMR collection query from fullPath hierarchy', () => {
    expect(redisPathStore.createCmrCollectionQuery({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2|LEVEL_3|LEVEL_4',
      prefLabel: 'SHORT_NAME',
      isLeaf: true
    })).toEqual({
      cmrScheme: 'data_center',
      method: 'POST',
      queryType: 'hierarchy',
      query: {
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            level_1: 'LEVEL_2',
            level_2: 'LEVEL_3',
            short_name: 'SHORT_NAME',
            ignore_case: false
          }
        }
      }
    })
  })

  test('creates a UUID-backed CMR collection query for science keywords', () => {
    expect(redisPathStore.createCmrCollectionQuery({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })).toEqual({
      cmrScheme: 'science_keywords',
      method: 'POST',
      queryType: 'uuid',
      query: {
        condition: {
          science_keywords: {
            uuid: '1234-5678-9ABC-DEF0'
          }
        }
      }
    })
  })

  test('returns canonical scalar keyword paths only when the object has a usable value', () => {
    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'temporalresolutionrange',
      keywordObject: {
        Value: 'P1D'
      }
    })).toBe('P1D')

    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'temporalresolutionrange',
      keywordObject: null
    })).toBeUndefined()

    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'temporalresolutionrange',
      keywordObject: {
        Value: ''
      }
    })).toBeUndefined()
  })

  test('returns scalar Value paths for schemes without slot or short-name lookup rules', () => {
    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'customscalar',
      keywordObject: {
        Value: 'P1D'
      }
    })).toBe('P1D')

    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'customscalar',
      keywordObject: {
        Value: ''
      }
    })).toBeUndefined()
  })

  test('returns no publish keyword events when neither draft nor published has schemes', async () => {
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([])

    await expect(redisPathStore.getPublishKeywordEvents()).resolves.toEqual({
      keywordChangesMap: new Map(),
      keywordEvents: [],
      keywordChangeSummary: {
        addedCount: 0,
        removedCount: 0,
        changedCount: 0
      },
      failedSchemes: [],
      totalSchemeCount: 0,
      keywordChangeCount: 0
    })

    expect(downloadConcepts).not.toHaveBeenCalled()
  })

  test('builds publish keyword events from published and draft CSV content', async () => {
    const emptyScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"'
    ].join('\n')
    const draftScienceCsv = [
      emptyScienceCsv,
      '"PATH","","","","","","","uuid-new"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(getConcepts).mockImplementation(async ({ queryStringParameters }) => ({
      statusCode: 200,
      body: queryStringParameters.version === 'published'
        ? emptyScienceCsv
        : draftScienceCsv
    }))

    const result = await redisPathStore.getPublishKeywordEvents()

    expect(getConceptSchemeDetails).toHaveBeenCalledWith({ version: 'published' })
    expect(getConceptSchemeDetails).toHaveBeenCalledWith({ version: 'draft' })
    expect(getConcepts).toHaveBeenCalled()

    expect(result.keywordChangeSummary).toEqual({
      addedCount: 1,
      removedCount: 0,
      changedCount: 0
    })

    expect(result.keywordChangeCount).toBe(1)
    expect(result.failedSchemes).toEqual([])
    expect(result.keywordEvents).toHaveLength(1)
    expect(result.keywordEvents[0]).toMatchObject({
      EventType: 'INSERTED',
      Scheme: 'sciencekeywords',
      UUID: 'uuid-new',
      NewKeywordObject: {
        Category: 'PATH',
        Topic: '',
        Term: '',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })
  })

  test('builds DELETED keyword events when a scheme only exists in published content', async () => {
    const publishedScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"PATH 1","","","","","","","uuid-removed"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([])

    vi.mocked(downloadConcepts).mockImplementation(async ({ version }) => (
      version === 'published' ? publishedScienceCsv : ''
    ))

    const result = await redisPathStore.getPublishKeywordEvents()

    expect(result.keywordChangeSummary).toEqual({
      addedCount: 0,
      removedCount: 1,
      changedCount: 0
    })

    expect(result.keywordEvents).toHaveLength(1)
    expect(result.keywordEvents[0]).toMatchObject({
      EventType: 'DELETED',
      Scheme: 'sciencekeywords',
      UUID: 'uuid-removed',
      OldKeywordObject: {
        Category: 'PATH 1'
      }
    })
  })

  test('builds INSERTED keyword events when a scheme only exists in draft content', async () => {
    const draftScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"PATH DRAFT","","","","","","","uuid-added"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(downloadConcepts).mockImplementation(async ({ version }) => (
      version === 'draft' ? draftScienceCsv : ''
    ))

    const result = await redisPathStore.getPublishKeywordEvents()

    expect(result.keywordChangeSummary).toEqual({
      addedCount: 1,
      removedCount: 0,
      changedCount: 0
    })

    expect(result.keywordEvents).toHaveLength(1)
    expect(result.keywordEvents[0]).toMatchObject({
      EventType: 'INSERTED',
      Scheme: 'sciencekeywords',
      UUID: 'uuid-added',
      NewKeywordObject: {
        Category: 'PATH DRAFT'
      }
    })
  })

  test('builds UPDATED keyword events when the same UUID changes path between published and draft', async () => {
    const publishedScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","","","","","uuid-updated"'
    ].join('\n')
    const draftScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE","CLOUDS","","","","","uuid-updated"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.useFakeTimers()
    vi.mocked(downloadConcepts).mockImplementation(async ({ version }) => (
      version === 'published' ? publishedScienceCsv : draftScienceCsv
    ))
    vi.mocked(getConcepts).mockImplementation(async ({ queryStringParameters }) => ({
      statusCode: 200,
      body: queryStringParameters.version === 'published'
        ? publishedScienceCsv
        : draftScienceCsv
    }))

    const resultPromise = redisPathStore.getPublishKeywordEvents()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.keywordChangeSummary).toEqual({
      addedCount: 0,
      removedCount: 0,
      changedCount: 1
    })

    expect(result.keywordEvents).toEqual([
      expect.objectContaining({
        EventType: 'UPDATED',
        Scheme: 'sciencekeywords',
        UUID: 'uuid-updated',
        OldKeywordObject: expect.objectContaining({
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS'
        }),
        NewKeywordObject: expect.objectContaining({
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'CLOUDS'
        })
      })
    ])

    vi.useRealTimers()
  })

  test('continues publish keyword analysis when a scheme fails and blocking is disabled', async () => {
    const emptyScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"'
    ].join('\n')
    const draftScienceCsv = [
      emptyScienceCsv,
      '"PATH","","","","","","","uuid-new"'
    ].join('\n')

    vi.useFakeTimers()

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ])
      .mockResolvedValueOnce([
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ])

    vi.mocked(getConcepts).mockImplementation(async ({ pathParameters, queryStringParameters }) => {
      if (pathParameters.conceptScheme === 'platforms') {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Download failed' })
        }
      }

      return {
        statusCode: 200,
        body: queryStringParameters.version === 'published'
          ? emptyScienceCsv
          : draftScienceCsv
      }
    })

    const resultPromise = redisPathStore.getPublishKeywordEvents()

    await vi.runAllTimersAsync()

    const result = await resultPromise

    expect(result.keywordEvents).toHaveLength(1)
    expect(result.keywordChangeCount).toBe(1)
    expect(result.failedSchemes).toEqual([
      {
        notation: 'platforms',
        error: 'Failed to download CSV. Status: 500 - Download failed'
      }
    ])

    expect(logger.warn).toHaveBeenCalledWith(
      '[publisher] Keyword changes detection failed for 1 scheme(s): '
      + 'platforms: Failed to download CSV. Status: 500 - Download failed. '
      + 'Continuing with publish because BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE is disabled.'
    )

    vi.useRealTimers()
  })

  test('writes published concept caches and uploads matching CSV snapshots', async () => {
    const send = vi.fn().mockResolvedValue({})
    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send })
    })

    vi.useFakeTimers()

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([
      { notation: 'SCHEME1' },
      { notation: 'SCHEME2' }
    ])

    vi.mocked(downloadConcepts)
      .mockResolvedValueOnce('csv,data,for,scheme1')
      .mockResolvedValueOnce('csv,data,for,scheme2')

    const [result] = await Promise.all([
      testStore.writePublishedConceptCaches(),
      vi.runAllTimersAsync()
    ])

    expect(getVersionMetadata).toHaveBeenCalledWith('published')
    expect(getConceptSchemeDetails).toHaveBeenCalledWith({ version: 'published' })
    expect(downloadConcepts).toHaveBeenNthCalledWith(1, {
      conceptScheme: 'SCHEME1',
      format: 'csv',
      version: 'published',
      bypassCache: true
    })

    expect(downloadConcepts).toHaveBeenNthCalledWith(2, {
      conceptScheme: 'SCHEME2',
      format: 'csv',
      version: 'published',
      bypassCache: true
    })

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({
      input: {
        Bucket: 'kms-rdf-backup-sit',
        Key: 'v22.1/SCHEME1.csv',
        Body: 'csv,data,for,scheme1',
        ContentType: 'text/csv'
      }
    }))

    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({
      input: {
        Bucket: 'kms-rdf-backup-sit',
        Key: 'v22.1/SCHEME2.csv',
        Body: 'csv,data,for,scheme2',
        ContentType: 'text/csv'
      }
    }))

    expect(result).toEqual({
      versionName: 'v22.1',
      schemeCount: 2,
      uploadedCount: 2,
      cachedCount: 0,
      cacheReady: true,
      schemeResults: [
        {
          notation: 'SCHEME1',
          csvContent: 'csv,data,for,scheme1',
          cachedCount: 0,
          skipped: true,
          skipReason: 'unsupported_scheme',
          cacheReady: true,
          cacheNamespaceScheme: 'scheme1'
        },
        {
          notation: 'SCHEME2',
          csvContent: 'csv,data,for,scheme2',
          cachedCount: 0,
          skipped: true,
          skipReason: 'unsupported_scheme',
          cacheReady: true,
          cacheNamespaceScheme: 'scheme2'
        }
      ],
      failedSchemes: []
    })
  })

  test('returns early when there are no published schemes to export', async () => {
    const send = vi.fn()
    const testStore = createTestStore({ send })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([])

    await expect(testStore.writePublishedConceptCaches()).resolves.toEqual({
      versionName: 'v22.1',
      schemeCount: 0,
      uploadedCount: 0,
      cachedCount: 0,
      cacheReady: true,
      schemeResults: [],
      failedSchemes: []
    })

    expect(logger.warn).toHaveBeenCalledWith('No published concept schemes found to export.')
    expect(send).not.toHaveBeenCalled()
  })

  test('throws when the published export bucket cannot be resolved from config', async () => {
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({})
    })

    vi.mocked(getApplicationConfig).mockReturnValue({ env: undefined })
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])
    vi.mocked(downloadConcepts).mockResolvedValue('csv,data')

    await expect(testStore.writePublishedConceptCaches())
      .rejects.toThrow('Application environment is required to export published CSV snapshots')
  })

  test('throws when published CSV export cannot determine a version name', async () => {
    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send: vi.fn() })
    })

    vi.mocked(getVersionMetadata).mockResolvedValue({ versionName: null })

    await expect(testStore.writePublishedConceptCaches())
      .rejects.toThrow('Could not determine published version name.')
  })

  test('throws with aggregated scheme failures when published cache writing cannot complete', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('S3 upload failed'))

    const testStore = createTestStore({ send })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([
      { notation: 'sciencekeywords' },
      { notation: 'platforms' }
    ])

    vi.mocked(downloadConcepts)
      .mockResolvedValueOnce(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)
      .mockRejectedValueOnce(new Error('Download failed'))

    await expect(testStore.writePublishedConceptCaches())
      .rejects.toThrow('Failed to export CSV for schemes: platforms, sciencekeywords')

    expect(logger.error).toHaveBeenCalledWith(
      '[publisher] Failed to prime published cache for scheme platforms: Download failed'
    )

    expect(logger.error).toHaveBeenCalledWith('Failed to process scheme sciencekeywords: S3 upload failed')
  })

  test('throws when publish keyword analysis exhausts retries and blocking is enabled', async () => {
    vi.useFakeTimers()

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(downloadConcepts).mockRejectedValue(new Error('Download failed'))

    const resultPromise = redisPathStore.getPublishKeywordEvents({
      blockOnFailure: true
    })
    const expectation = expect(resultPromise).rejects.toThrow(
      'Keyword changes detection failed for 1 scheme(s): sciencekeywords: Download failed'
    )

    await vi.runAllTimersAsync()

    await expectation

    vi.useRealTimers()
  })

  test('downloads CSV content and writes published concept entries through redisPathStore', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient: mockRedisClient
    })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)

    vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient)
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])

    const result = await testStore.writePublishedConceptCaches()

    expect(downloadConcepts).toHaveBeenCalledWith({
      conceptScheme: 'sciencekeywords',
      format: 'csv',
      version: 'published',
      bypassCache: true
    })

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:sciencekeywords:published_concept'
    })

    expect(result).toEqual({
      versionName: 'v22.1',
      schemeCount: 1,
      uploadedCount: 1,
      schemeResults: [
        {
          notation: 'sciencekeywords',
          csvContent: `"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`,
          cachedCount: 2,
          skipped: false,
          skipReason: null,
          cacheReady: true,
          cacheNamespaceScheme: 'sciencekeywords'
        }
      ],
      failedSchemes: [],
      cachedCount: 2,
      cacheReady: true
    })
  })

  test('writes full-path published cache entries with both full-path and uuid keys', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient: mockRedisClient
    })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)

    vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient)

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])

    await testStore.writePublishedConceptCaches()

    expect(mockRedisClient.mSet).toHaveBeenCalledWith([
      'kms:sciencekeywords:published_concept:full_path:earth%20science%20%3E%20atmosphere%20%3E%20aerosols',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-1',
          fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        })
      }),
      'kms:sciencekeywords:published_concept:uuid:uuid-1',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-1',
          fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        })
      })
    ])
  })

  test('writes short-name published cache entries with both short-name and uuid keys', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient: mockRedisClient
    })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Category","Class","Type","Short_Name","Long_Name","UUID"
"Platforms","Space-based Platforms","Earth Observation Satellites","Aqua","Aqua satellite","uuid-2"`)

    vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient)

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'platforms' }])

    await testStore.writePublishedConceptCaches()

    expect(mockRedisClient.mSet).toHaveBeenCalledWith([
      'kms:platforms:published_concept:short_name:aqua',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-2',
          fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua',
          keywordObject: {
            Category: 'Platforms',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'Aqua',
            LongName: 'Aqua satellite'
          },
          longName: 'Aqua satellite'
        })
      }),
      'kms:platforms:published_concept:uuid:uuid-2',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-2',
          fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua',
          keywordObject: {
            Category: 'Platforms',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'Aqua',
            LongName: 'Aqua satellite'
          },
          longName: 'Aqua satellite'
        })
      })
    ])
  })

  test('writes provider published cache entries with provider URLs attached', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient: mockRedisClient
    })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Bucket_Level_0","Bucket_Level_1","Bucket_Level_2","Bucket_Level_3","Short_Name","Long_Name","Data_Center_URL","UUID"
"ARCHIVER","","","","NZ/NZAI/ANZ","National Archive","https://example.com/provider","uuid-provider"`)

    vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient)
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'providers' }])

    await testStore.writePublishedConceptCaches()

    expect(mockRedisClient.mSet).toHaveBeenCalledWith([
      'kms:providers:published_concept:short_name:nz%2Fnzai%2Fanz',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-provider',
          fullPath: 'ARCHIVER >  >  >  > NZ/NZAI/ANZ',
          keywordObject: {
            BucketLevel0: 'ARCHIVER',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NZ/NZAI/ANZ',
            LongName: 'National Archive',
            DataCenterUrl: 'https://example.com/provider'
          },
          longName: 'National Archive',
          providerUrl: 'https://example.com/provider'
        })
      }),
      'kms:providers:published_concept:uuid:uuid-provider',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-provider',
          fullPath: 'ARCHIVER >  >  >  > NZ/NZAI/ANZ',
          keywordObject: {
            BucketLevel0: 'ARCHIVER',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NZ/NZAI/ANZ',
            LongName: 'National Archive',
            DataCenterUrl: 'https://example.com/provider'
          },
          longName: 'National Archive',
          providerUrl: 'https://example.com/provider'
        })
      })
    ])
  })

  test('skips unsupported schemes when the store reports them unsupported', async () => {
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({})
    })

    vi.mocked(downloadConcepts).mockResolvedValue('csv-content')
    vi.mocked(getRedisClient).mockResolvedValue({
      mSet: vi.fn()
    })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'unknownscheme' }])

    const result = await testStore.writePublishedConceptCaches()

    expect(result).toEqual({
      versionName: 'v22.1',
      schemeCount: 1,
      uploadedCount: 1,
      schemeResults: [
        {
          notation: 'unknownscheme',
          csvContent: 'csv-content',
          cachedCount: 0,
          skipped: true,
          skipReason: 'unsupported_scheme',
          cacheReady: true,
          cacheNamespaceScheme: 'unknownscheme'
        }
      ],
      failedSchemes: [],
      cachedCount: 0,
      cacheReady: true
    })
  })

  test('throws when published cache writing cannot use redis', async () => {
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient: null
    })

    vi.mocked(downloadConcepts).mockResolvedValue('csv-content')
    vi.mocked(getRedisClient).mockResolvedValue(null)
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])

    await expect(testStore.writePublishedConceptCaches())
      .rejects.toThrow('Failed to export CSV for schemes: sciencekeywords')

    expect(logger.warn).toHaveBeenCalledWith(
      '[publisher] Skipping published concept cache prime scheme=sciencekeywords reason=redis_unavailable'
    )

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to process scheme sciencekeywords: Published concept cache not ready for scheme=sciencekeywords reason=redis_unavailable'
    )
  })

  test('returns cachedCount 0 when there are no entries to write', async () => {
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient: {
        mSet: vi.fn().mockResolvedValue('OK')
      }
    })

    vi.mocked(downloadConcepts).mockResolvedValue('csv-content')
    vi.mocked(getRedisClient).mockResolvedValue({
      mSet: vi.fn().mockResolvedValue('OK')
    })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])

    const result = await testStore.writePublishedConceptCaches()

    expect(result).toEqual({
      versionName: 'v22.1',
      schemeCount: 1,
      uploadedCount: 1,
      schemeResults: [
        {
          notation: 'sciencekeywords',
          csvContent: 'csv-content',
          cachedCount: 0,
          skipped: false,
          skipReason: null,
          cacheReady: true,
          cacheNamespaceScheme: 'sciencekeywords'
        }
      ],
      failedSchemes: [],
      cachedCount: 0,
      cacheReady: true
    })
  })

  test('skips published cache rows whose parsed cache key or value is blank', async () => {
    const redisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient
    })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS",""`)
    vi.mocked(getRedisClient).mockResolvedValue(redisClient)
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])

    const result = await testStore.writePublishedConceptCaches()

    expect(redisClient.mSet).not.toHaveBeenCalled()
    expect(result.cachedCount).toBe(0)
    expect(result.schemeResults[0]).toMatchObject({
      notation: 'sciencekeywords',
      cachedCount: 0,
      skipped: false,
      cacheReady: true
    })
  })

  test('tracks failed schemes when CSV download throws', async () => {
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({})
    })

    vi.mocked(downloadConcepts).mockRejectedValue(new Error('Download failed'))
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])

    await expect(testStore.writePublishedConceptCaches())
      .rejects.toThrow('Failed to export CSV for schemes: sciencekeywords')

    expect(logger.error).toHaveBeenCalledWith(
      '[publisher] Failed to prime published cache for scheme sciencekeywords: Download failed'
    )
  })

  test('skips scheme entries without a notation while writing published concept caches', async () => {
    const send = vi.fn().mockResolvedValue({})
    const testStore = createTestStore({ send })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([
      {},
      { notation: 'sciencekeywords' }
    ])
    vi.mocked(downloadConcepts).mockResolvedValue('csv-content')

    const result = await testStore.writePublishedConceptCaches()

    expect(downloadConcepts).toHaveBeenCalledTimes(1)
    expect(result.schemeResults).toHaveLength(1)
    expect(result.schemeResults[0].notation).toBe('sciencekeywords')
  })

  test('uses RDF_BUCKET_NAME from the environment when rebuilding historical cache', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn().mockResolvedValue({ CommonPrefixes: [] })
    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn(),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet: vi.fn()
      })
    })

    await testStore.rebuildHistoricalConceptCache()

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        Bucket: 'test-bucket'
      })
    }))
  })

  test('throws an error when redis is unavailable while rebuilding historical cache', async () => {
    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send: vi.fn() }),
      redisClientProvider: async () => null
    })

    await expect(testStore.rebuildHistoricalConceptCache()).rejects.toThrow(
      'Redis is required to build the historical concept cache.'
    )
  })

  test('throws when the historical rebuild bucket cannot be resolved from config', async () => {
    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send: vi.fn() }),
      redisClientProvider: async () => ({
        sAdd: vi.fn(),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet: vi.fn()
      })
    })

    vi.mocked(getApplicationConfig).mockReturnValue({ env: undefined })

    await expect(testStore.rebuildHistoricalConceptCache()).rejects.toThrow(
      'RDF bucket name is required to rebuild the historical cache'
    )
  })

  test('finds and processes supported CSV files through redisPathStore', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const mockSAdd = vi.fn().mockResolvedValue(1)
    const mockSMembers = vi.fn().mockResolvedValue([])
    const mockMSet = vi.fn().mockResolvedValue('OK')
    const send = vi.fn()

    send
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '2.0/platforms.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)])
      })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Class","Type","Short_Name","Long_Name","UUID"
"Platforms","Space-based Platforms","Earth Observation Satellites","AQUA","Aqua satellite","uuid-2"`)])
      })

    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: mockSAdd,
        sMembers: mockSMembers,
        mSet: mockMSet
      })
    })

    const result = await testStore.rebuildHistoricalConceptCache()

    expect(mockMSet).toHaveBeenCalledTimes(2)
    expect(mockSAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '1.0')
    expect(mockSAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '2.0')
    expect(result).toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 2,
      processedFileCount: 2,
      markedVersionCount: 2
    })
  })

  test('handles cases where no version directories are found while rebuilding historical cache', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const mSet = vi.fn()
    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({
        send: vi.fn().mockResolvedValue({ CommonPrefixes: [] })
      }),
      redisClientProvider: async () => ({
        sAdd: vi.fn(),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet
      })
    })

    await testStore.rebuildHistoricalConceptCache()

    expect(mSet).not.toHaveBeenCalled()
  })

  test('handles cases where no CSV files are found while rebuilding historical cache', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const mSet = vi.fn()
    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.eio/' }] })
      .mockResolvedValueOnce({ Contents: [] })

    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn(),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet
      })
    })

    await testStore.rebuildHistoricalConceptCache()

    expect(mSet).not.toHaveBeenCalled()
  })

  test('skips CSV files for unrecognized schemes while rebuilding historical cache', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const mSet = vi.fn().mockResolvedValue('OK')
    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({
        Contents: [
          { Key: '1.0/sciencekeywords.csv' },
          { Key: '1.0/unknown.csv' }
        ]
      })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)])
      })

    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn().mockResolvedValue(1),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet
      })
    })

    await testStore.rebuildHistoricalConceptCache()

    expect(mSet).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(3)
  })

  test('throws an error if processing a historical cache file fails', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)])
      })

    const testStore = new RedisPathStore({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn().mockResolvedValue(1),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet: vi.fn().mockRejectedValue(new Error('bad CSV'))
      })
    })

    await expect(testStore.rebuildHistoricalConceptCache()).rejects.toThrow(
      /Failed to process 1 of 1 CSV files/
    )
  })

  test('skips non-CSV files when rebuilding the historical cache', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({
        Contents: [
          { Key: '1.0/readme.txt' },
          { Key: '1.0/sciencekeywords.csv' },
          { Key: '1.0/sciencekeywords.json' }
        ]
      })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)])
      })

    const redisClient = {
      sAdd: vi.fn().mockResolvedValue(1),
      sMembers: vi.fn().mockResolvedValue([]),
      mSet: vi.fn().mockResolvedValue('OK')
    }

    const testStore = createTestStore({
      send,
      redisClient
    })

    await testStore.rebuildHistoricalConceptCache()

    expect(redisClient.mSet).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(3)
  })

  test('skips historical versions that are already marked as built', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '2.0/sciencekeywords.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-2"`)])
      })

    const redisClient = {
      sAdd: vi.fn().mockResolvedValue(1),
      sMembers: vi.fn().mockResolvedValue(['1.0']),
      mSet: vi.fn().mockResolvedValue('OK')
    }

    const testStore = createTestStore({
      send,
      redisClient
    })

    const result = await testStore.rebuildHistoricalConceptCache()

    expect(result).toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })

    expect(send).toHaveBeenCalledTimes(3)
  })

  test('continues rebuilding historical cache when built-version markers cannot be read', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)])
      })

    const redisClient = {
      sAdd: vi.fn().mockResolvedValue(1),
      sMembers: vi.fn().mockRejectedValue(new Error('redis read failed')),
      mSet: vi.fn().mockResolvedValue('OK')
    }

    const testStore = createTestStore({
      send,
      redisClient
    })

    await expect(testStore.rebuildHistoricalConceptCache()).resolves.toMatchObject({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })

    expect(logger.warn).toHaveBeenCalledWith(
      '[cache-builder] Failed reading historical cache version markers key=kms:historical_concept:versions:built:v1 error=redis read failed'
    )
  })

  test('returns early when all historical versions are already marked as built', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })

    const testStore = createTestStore({
      send,
      redisClient: {
        sAdd: vi.fn().mockResolvedValue(1),
        sMembers: vi.fn().mockResolvedValue(['1.0', '2.0']),
        mSet: vi.fn().mockResolvedValue('OK')
      }
    })

    await expect(testStore.rebuildHistoricalConceptCache()).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 0,
      processedFileCount: 0,
      markedVersionCount: 0
    })

    expect(send).toHaveBeenCalledTimes(1)
  })

  test('throws detailed errors when listing historical CSV files fails for a version directory', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockRejectedValueOnce(new Error('Access Denied'))

    const testStore = createTestStore({ send })

    await expect(testStore.rebuildHistoricalConceptCache()).rejects.toThrow(
      'Failed to list CSV files in 1 version directories. Historical cache must include all versions.'
    )
  })

  test('skips version markers for directories with no valid CSV files while still processing other versions', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      .mockResolvedValueOnce({ Contents: [] })
      .mockResolvedValueOnce({ Contents: [{ Key: '2.0/sciencekeywords.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-2"`)])
      })

    const redisClient = {
      sAdd: vi.fn().mockResolvedValue(1),
      sMembers: vi.fn().mockResolvedValue([]),
      mSet: vi.fn().mockResolvedValue('OK')
    }

    const testStore = createTestStore({
      send,
      redisClient
    })

    await expect(testStore.rebuildHistoricalConceptCache()).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 2,
      processedFileCount: 1,
      markedVersionCount: 1
    })

    expect(logger.info).toHaveBeenCalledWith(
      '[cache-builder] Skipping historical cache version marker version=1.0 reason=no-valid-csv-files'
    )
  })

  test('throws after processing when any historical version directory listing failed', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn().mockImplementation(async (command) => {
      const { input } = command

      if (input.Delimiter === '/') {
        return { CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] }
      }

      if (input.Prefix === '1.0/') {
        return { Contents: [{ Key: '1.0/sciencekeywords.csv' }] }
      }

      if (input.Prefix === '2.0/') {
        throw new Error('Access Denied')
      }

      if (input.Key === '1.0/sciencekeywords.csv') {
        return {
          Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)])
        }
      }

      throw new Error(`Unexpected S3 request: ${JSON.stringify(input)}`)
    })

    const testStore = createTestStore({
      send,
      redisClient: {
        sAdd: vi.fn().mockResolvedValue(1),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet: vi.fn().mockResolvedValue('OK')
      }
    })

    await expect(testStore.rebuildHistoricalConceptCache()).rejects.toThrow(
      'Failed to list CSV files in 1 version directories. Historical cache must include all versions.'
    )
  })

  test('continues when writing a historical cache built-version marker fails', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/platforms.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Class","Type","Short_Name","Long_Name","UUID"
"Platforms","Space-based Platforms","Earth Observation Satellites","AQUA","Aqua satellite","uuid-2"`)])
      })

    const redisClient = {
      sAdd: vi.fn().mockRejectedValueOnce(new Error('redis write failed')),
      sMembers: vi.fn().mockResolvedValue([]),
      mSet: vi.fn().mockResolvedValue('OK')
    }

    const testStore = createTestStore({
      send,
      redisClient
    })

    await expect(testStore.rebuildHistoricalConceptCache()).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })

    expect(logger.warn).toHaveBeenCalledWith(
      '[cache-builder] Failed writing historical cache version marker version=1.0 key=kms:historical_concept:versions:built:v1 error=redis write failed'
    )
  })

  test('throws an error with details when multiple historical cache files fail to process', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({
        Contents: [
          { Key: '1.0/sciencekeywords.csv' },
          { Key: '1.0/platforms.csv' }
        ]
      })
      .mockRejectedValueOnce(new Error('Download Failed'))
      .mockRejectedValueOnce(new Error('Timeout'))

    const testStore = createTestStore({ send })

    await expect(testStore.rebuildHistoricalConceptCache()).rejects.toThrow(
      'Failed to process 2 of 2 CSV files. Historical cache must include all archived versions.'
    )
  })

  test('routes slotted keyword objects to the historical full-path lookup', async () => {
    const cacheKey = createConceptResponseCacheKeyByFullPath({
      fullPath: 'earth science > cryosphere >  > snow/ice >  >  > ',
      scheme: 'sciencekeywords'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'science-uuid',
        fullPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > '
      })
    })

    await expect(redisPathStore.getHistoricalConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        Term: '',
        VariableLevel1: 'SNOW/ICE',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })).resolves.toMatchObject({
      uuid: 'science-uuid',
      fullPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > ',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        Term: '',
        VariableLevel1: 'SNOW/ICE',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by fullPath',
      bypassCache: false
    })
  })

  test('pads array-based full-path keyword values into canonical historical lookup paths', async () => {
    const cacheKey = createConceptResponseCacheKeyByFullPath({
      fullPath: 'earth science > atmosphere >  >  >  >  > ',
      scheme: 'sciencekeywords'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'science-uuid',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE >  >  >  >  > '
      })
    })

    await redisPathStore.getHistoricalConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordValue: ['EARTH SCIENCE', 'ATMOSPHERE']
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by fullPath',
      bypassCache: false
    })
  })

  test('rebuilds canonical audit paths from normalized keyword objects', () => {
    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'providers',
      keywordObject: {
        BucketLevel0: 'ARCHIVER',
        BucketLevel1: '',
        BucketLevel2: '',
        BucketLevel3: '',
        ShortName: 'NZ/NZAI/ANZ'
      }
    })).toBe('ARCHIVER >  >  >  > NZ/NZAI/ANZ')

    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'rucontenttype',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })).toBe('CollectionURL > PROJECT HOME PAGE > ')

    expect(redisPathStore.getKeywordPathFromKeywordObject({
      scheme: 'temporalresolutionrange',
      keywordObject: {
        Value: 'P1D'
      }
    })).toBe('P1D')
  })

  test('returns undefined or throws for unsupported and blank lookup flows', async () => {
    await expect(redisPathStore.getHistoricalConceptByFullPath({
      fullPath: 'Platforms > Aqua',
      scheme: 'platforms'
    })).rejects.toThrow('Historical fullPath lookup is not supported for scheme=platforms')

    await expect(redisPathStore.getHistoricalConceptByShortName({
      shortName: 'AQUA',
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Historical shortName lookup is not supported for scheme=sciencekeywords')

    await expect(redisPathStore.getHistoricalConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {}
    })).resolves.toBeUndefined()

    await expect(redisPathStore.getHistoricalConceptByKeyword({
      scheme: 'unsupported-scheme',
      keywordValue: 'anything'
    })).resolves.toBeUndefined()

    await expect(redisPathStore.getPublishedConceptByKeyword({
      scheme: 'unsupported-scheme',
      keywordValue: 'anything'
    })).resolves.toBeUndefined()
  })

  test('merges cached keywordObject payloads with canonical path fields on read', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'nz/nzai/anz',
      scheme: 'providers'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'provider-uuid',
        fullPath: 'ARCHIVER >  >  >  > NZ/NZAI/ANZ',
        providerUrl: 'https://example.com/provider',
        keywordObject: {
          LongName: 'National Archive'
        }
      })
    })

    await expect(redisPathStore.getPublishedConceptByKeyword({
      scheme: 'providers',
      keywordObject: {
        ShortName: 'NZ/NZAI/ANZ'
      }
    })).resolves.toMatchObject({
      uuid: 'provider-uuid',
      keywordObject: {
        BucketLevel0: 'ARCHIVER',
        BucketLevel1: '',
        BucketLevel2: '',
        BucketLevel3: '',
        ShortName: 'NZ/NZAI/ANZ',
        LongName: 'National Archive',
        DataCenterUrl: 'https://example.com/provider'
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('returns undefined when a cached concept body parses to null', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: 'null'
    })

    await expect(redisPathStore.getPublishedConceptByUuid({
      scheme: 'sciencekeywords',
      uuid: 'uuid-null'
    })).resolves.toBeUndefined()
  })

  test('strips a leading science-keywords label when reconstructing keyword objects from cached paths', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'science-uuid',
        fullPath: 'Science Keywords > EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(redisPathStore.getPublishedConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).resolves.toMatchObject({
      uuid: 'science-uuid',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })
  })

  test('reconstructs project keyword objects from cached short-name paths', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'project-uuid',
        fullPath: 'A - C > ALIENS'
      })
    })

    await expect(redisPathStore.getPublishedConceptByKeyword({
      scheme: 'projects',
      keywordObject: {
        ShortName: 'ALIENS'
      }
    })).resolves.toMatchObject({
      uuid: 'project-uuid',
      keywordObject: {
        Category: 'A - C',
        ShortName: 'ALIENS'
      }
    })
  })

  test('appends long-name columns when generating CSV rows for long-name schemes', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Category',
      'Class',
      'Type',
      'Short_Name',
      'Long_Name',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Platforms' },
        subject: { value: 'http://example.com/platforms' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({
      'http://example.com/aqua': 'Aqua satellite'
    })
    vi.mocked(isCsvLongNameFlag).mockReturnValue(true)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/platforms') {
        return [
          {
            narrowerPrefLabel: 'Aqua',
            uri: 'http://example.com/aqua'
          }
        ]
      }

      return []
    })

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await redisPathStore.getCsvForScheme({
      scheme: 'platforms',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Category', 'Class', 'Type', 'Short_Name', 'Long_Name', 'UUID'],
      [
        ['', '', '', 'Aqua', 'Aqua satellite', 'aqua']
      ]
    )
  })

  test('writes sorted CSV content for a scheme through the centralized hierarchy walk', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue(['Header1', 'Header2', 'UUID'])
    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/root') {
        return [
          {
            narrowerPrefLabel: 'Zulu',
            uri: 'http://example.com/z'
          },
          {
            narrowerPrefLabel: 'Alpha',
            uri: 'http://example.com/a'
          }
        ]
      }

      return []
    })

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await expect(redisPathStore.getCsvForScheme({
      scheme: 'testScheme',
      version: 'draft',
      versionName: 'Test Version',
      versionCreationDate: '2023-01-01'
    })).resolves.toBe('csv,content')

    expect(createCsvMetadata).toHaveBeenCalledWith({
      scheme: 'testScheme',
      versionName: 'Test Version',
      versionCreationDate: '2023-01-01'
    })

    expect(getCsvHeaders).toHaveBeenCalledWith('testScheme', 'draft')
    expect(getRootConceptForScheme).toHaveBeenCalledWith('testScheme', 'draft')
    expect(getNarrowersMap).toHaveBeenCalledWith('testScheme', 'draft')
    expect(getLongNamesMap).toHaveBeenCalledWith('testScheme', 'draft')
    expect(getProviderUrlsMap).not.toHaveBeenCalled()
    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Header1', 'Header2', 'UUID'],
      [
        ['Alpha', 'a'],
        ['Zulu', 'z']
      ]
    )
  })

  test('sorts CSV rows by shorter length when the shared prefix is identical', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue(['Header1', 'Header2', 'Header3', 'UUID'])
    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/root') {
        return [
          {
            narrowerPrefLabel: 'Alpha',
            uri: 'http://example.com/alpha-leaf'
          },
          {
            narrowerPrefLabel: 'Alpha',
            uri: 'http://example.com/alpha-branch'
          }
        ]
      }

      if (uri === 'http://example.com/alpha-branch') {
        return [
          {
            narrowerPrefLabel: 'Beta',
            uri: 'http://example.com/beta'
          }
        ]
      }

      return []
    })

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await redisPathStore.getCsvForScheme({
      scheme: 'testScheme',
      version: 'draft',
      versionName: 'Test Version',
      versionCreationDate: '2023-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Header1', 'Header2', 'Header3', 'UUID'],
      [
        ['Alpha', 'alpha-branch'],
        ['Alpha', 'alpha-leaf'],
        ['Alpha', 'Beta', 'beta']
      ]
    )
  })

  test('pads full-path CSV rows for science keyword exports', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Category',
      'Topic',
      'Term',
      'Variable_Level_1',
      'Variable_Level_2',
      'Variable_Level_3',
      'Detailed_Variable',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Science Keywords' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/root') {
        return [
          {
            narrowerPrefLabel: 'EARTH SCIENCE',
            uri: 'http://example.com/category'
          }
        ]
      }

      if (uri === 'http://example.com/category') {
        return [
          {
            narrowerPrefLabel: 'ATMOSPHERE',
            uri: 'http://example.com/topic'
          }
        ]
      }

      if (uri === 'http://example.com/topic') {
        return [
          {
            narrowerPrefLabel: 'AEROSOLS',
            uri: 'http://example.com/term'
          }
        ]
      }

      return []
    })

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await redisPathStore.getCsvForScheme({
      scheme: 'sciencekeywords',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      [
        'Category',
        'Topic',
        'Term',
        'Variable_Level_1',
        'Variable_Level_2',
        'Variable_Level_3',
        'Detailed_Variable',
        'UUID'
      ],
      [
        ['EARTH SCIENCE', '', '', '', '', '', '', 'category'],
        ['EARTH SCIENCE', 'ATMOSPHERE', '', '', '', '', '', 'topic'],
        ['EARTH SCIENCE', 'ATMOSPHERE', 'AEROSOLS', '', '', '', '', 'term']
      ]
    )
  })

  test('pads non-leaf provider CSV rows into bucket slots', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Bucket_Level_0',
      'Bucket_Level_1',
      'Bucket_Level_2',
      'Bucket_Level_3',
      'Short_Name',
      'Data_Center_URL',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'ARCHIVER' },
        subject: { value: 'http://example.com/archiver' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(getProviderUrlsMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(true)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/archiver') {
        return [
          {
            narrowerPrefLabel: 'REGIONAL',
            uri: 'http://example.com/regional'
          }
        ]
      }

      if (uri === 'http://example.com/regional') {
        return [
          {
            narrowerPrefLabel: 'KPDC',
            uri: 'http://example.com/provider'
          }
        ]
      }

      return []
    })

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await redisPathStore.getCsvForScheme({
      scheme: 'providers',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Bucket_Level_0', 'Bucket_Level_1', 'Bucket_Level_2', 'Bucket_Level_3', 'Short_Name', 'Data_Center_URL', 'UUID'],
      [
        ['REGIONAL', '', '', '', '', 'regional'],
        ['REGIONAL', '', '', 'KPDC', '', 'provider']
      ]
    )
  })

  test('writes CSV content with generated headers when scheme headers are not defined', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue([])
    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/root') {
        return [
          {
            narrowerPrefLabel: 'Alpha',
            uri: 'http://example.com/a'
          }
        ]
      }

      return []
    })

    vi.mocked(getMaxLengthOfSubArray).mockReturnValue(2)
    vi.mocked(generateCsvHeaders).mockResolvedValue([
      'Platforms',
      'Level1',
      'UUID'
    ])

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await expect(redisPathStore.getCsvForScheme({
      scheme: 'testScheme',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })).resolves.toBe('csv,content')

    expect(getMaxLengthOfSubArray).toHaveBeenCalledWith([
      ['Alpha', 'a']
    ])

    expect(generateCsvHeaders).toHaveBeenCalledWith('testScheme', 'published', 2)
    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Platforms', 'Level1', 'UUID'],
      [
        ['Alpha', 'a']
      ]
    )
  })

  test('writes CSV content with scheme-specific sparse-slot padding when headers are present', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Category',
      'Class',
      'Type',
      'Short_Name',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Platforms' },
        subject: { value: 'http://example.com/platforms' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/platforms') {
        return [
          {
            narrowerPrefLabel: 'Earth Observation Satellites',
            uri: 'http://example.com/type'
          }
        ]
      }

      if (uri === 'http://example.com/type') {
        return [
          {
            narrowerPrefLabel: 'SPOT-4',
            uri: 'http://example.com/spot'
          }
        ]
      }

      return []
    })

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await expect(redisPathStore.getCsvForScheme({
      scheme: 'platforms',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })).resolves.toBe('csv,content')

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Category', 'Class', 'Type', 'Short_Name', 'UUID'],
      [
        ['Earth Observation Satellites', '', '', 'type'],
        ['Earth Observation Satellites', '', 'SPOT-4', 'spot']
      ]
    )
  })

  test('loads provider URLs and appends them when generating provider CSV content', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Bucket_Level_0',
      'Bucket_Level_1',
      'Bucket_Level_2',
      'Bucket_Level_3',
      'Short_Name',
      'Data_Center_URL',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'ARCHIVER' },
        subject: { value: 'http://example.com/archiver' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(getProviderUrlsMap).mockResolvedValue({
      'http://example.com/provider': ['https://example.com/provider']
    })

    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(true)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/archiver') {
        return [
          {
            narrowerPrefLabel: 'KPDC',
            uri: 'http://example.com/provider'
          }
        ]
      }

      return []
    })

    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await expect(redisPathStore.getCsvForScheme({
      scheme: 'providers',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })).resolves.toBe('csv,content')

    expect(getProviderUrlsMap).toHaveBeenCalledWith('providers', 'published')
    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Bucket_Level_0', 'Bucket_Level_1', 'Bucket_Level_2', 'Bucket_Level_3', 'Short_Name', 'Data_Center_URL', 'UUID'],
      [
        ['', '', '', 'KPDC', 'https://example.com/provider', 'provider']
      ]
    )
  })

  test('omits root-only nodes when generating CSV rows for a scheme', async () => {
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getCsvHeaders).mockResolvedValue(['Header1', 'UUID'])
    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(getNarrowers).mockReturnValue([])
    vi.mocked(createCsv).mockResolvedValue('csv,content')

    await redisPathStore.getCsvForScheme({
      scheme: 'testScheme',
      version: 'draft',
      versionName: 'Test Version',
      versionCreationDate: '2023-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Header1', 'UUID'],
      []
    )
  })

  test('primes published cache entries and normalizes the cache namespace alias', async () => {
    const redisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const testStore = createTestStore({
      send: vi.fn().mockResolvedValue({}),
      redisClient
    })

    vi.mocked(getRedisClient).mockResolvedValue(redisClient)
    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Short_Name","Long_Name","UUID"
"netCDF-4","Network Common Data Form","uuid-3"`)

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'granuledataformat' }])

    const result = await testStore.writePublishedConceptCaches()

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:dataformat:published_concept'
    })

    expect(result).toMatchObject({
      versionName: 'v22.1',
      schemeCount: 1,
      uploadedCount: 1,
      cachedCount: 2,
      cacheReady: true,
      failedSchemes: []
    })

    expect(result.schemeResults).toMatchObject([
      {
        notation: 'granuledataformat',
        cacheNamespaceScheme: 'dataformat',
        skipped: false,
        cachedCount: 2,
        cacheReady: true
      }
    ])
  })

  test('routes short-name keyword objects to the historical short-name lookup', async () => {
    const cacheKey = createConceptResponseCacheKeyByShortName({
      shortName: 'aqua',
      scheme: 'platforms'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'platform-uuid',
        fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > AQUA',
        longName: 'Aqua satellite'
      })
    })

    await expect(redisPathStore.getHistoricalConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {
        ShortName: 'AQUA'
      }
    })).resolves.toMatchObject({
      uuid: 'platform-uuid',
      fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > AQUA',
      longName: 'Aqua satellite',
      keywordObject: {
        Category: 'Platforms',
        Class: 'Space-based Platforms',
        Type: 'Earth Observation Satellites',
        ShortName: 'AQUA',
        LongName: 'Aqua satellite'
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by shortName',
      bypassCache: false
    })
  })

  test('reads published full-path concepts using the canonical path built from the object', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByFullPath({
      fullPath: 'collectionurl > project home page > ',
      scheme: 'rucontenttype'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'ru-uuid',
        fullPath: 'CollectionURL > PROJECT HOME PAGE > '
      })
    })

    await expect(redisPathStore.getPublishedConceptByKeyword({
      scheme: 'rucontenttype',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })).resolves.toMatchObject({
      uuid: 'ru-uuid',
      fullPath: 'CollectionURL > PROJECT HOME PAGE > ',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('reads published short-name concepts using the keyword object short name', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'modis',
      scheme: 'instruments'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'instrument-uuid',
        fullPath: 'EARTH REMOTE SENSING INSTRUMENTS > ACTIVE REMOTE SENSING > ALTIMETERS > MODIS',
        longName: 'Moderate Resolution Imaging Spectroradiometer'
      })
    })

    await expect(redisPathStore.getPublishedConceptByKeyword({
      scheme: 'instruments',
      keywordObject: {
        ShortName: 'MODIS'
      }
    })).resolves.toMatchObject({
      uuid: 'instrument-uuid',
      fullPath: 'EARTH REMOTE SENSING INSTRUMENTS > ACTIVE REMOTE SENSING > ALTIMETERS > MODIS',
      longName: 'Moderate Resolution Imaging Spectroradiometer',
      keywordObject: {
        Category: 'EARTH REMOTE SENSING INSTRUMENTS',
        Class: 'ACTIVE REMOTE SENSING',
        Subclass: 'ALTIMETERS',
        ShortName: 'MODIS',
        LongName: 'Moderate Resolution Imaging Spectroradiometer'
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('reads published concepts by uuid through the same store', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-1',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(redisPathStore.getPublishedConceptByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })).resolves.toMatchObject({
      uuid: 'uuid-1',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by uuid'
    })
  })

  test('returns undefined when the normalized keyword object does not contain a usable lookup value', async () => {
    await expect(redisPathStore.getHistoricalConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: '',
        Topic: '',
        Term: '',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })).resolves.toBeUndefined()

    await expect(redisPathStore.getPublishedConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {}
    })).resolves.toBeUndefined()

    expect(getCachedJsonResponse).not.toHaveBeenCalled()
  })

  test('preserves the direct full-path and short-name entrypoints for compatibility', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValueOnce({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    }).mockResolvedValueOnce({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > MODIS'
      })
    })

    await expect(redisPathStore.getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })

    await expect(redisPathStore.getHistoricalConceptByShortName({
      shortName: 'MODIS',
      scheme: 'instruments'
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > MODIS',
      keywordObject: {
        Category: 'AIR-BASED PLATFORMS',
        Class: 'PROPELLER',
        Subclass: '',
        ShortName: 'MODIS'
      }
    })
  })

  test('returns undefined when the direct lookup entrypoints do not have a cached body', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200
    })

    await expect(redisPathStore.getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()

    await expect(redisPathStore.getHistoricalConceptByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    })).resolves.toBeUndefined()

    await expect(redisPathStore.getPublishedConceptByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()
  })

  test('preserves direct short-name lookups with long-name payloads', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > AC-690A',
        longName: 'Aerocommander aircraft'
      })
    })

    await expect(redisPathStore.getHistoricalConceptByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > AC-690A',
      longName: 'Aerocommander aircraft',
      keywordObject: {
        Category: 'AIR-BASED PLATFORMS',
        Class: 'PROPELLER',
        Subclass: '',
        ShortName: 'AC-690A',
        LongName: 'Aerocommander aircraft'
      }
    })
  })

  test('throws when the direct full-path lookup arguments are missing', async () => {
    await expect(redisPathStore.getHistoricalConceptByFullPath({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing full path for historical concept lookup')

    await expect(redisPathStore.getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })).rejects.toThrow('Missing scheme for historical concept lookup')
  })

  test('throws when the direct short-name lookup arguments are missing', async () => {
    await expect(redisPathStore.getHistoricalConceptByShortName({
      scheme: 'instruments'
    })).rejects.toThrow('Missing short name for historical concept lookup')

    await expect(redisPathStore.getHistoricalConceptByShortName({
      shortName: 'AC-690A'
    })).rejects.toThrow('Missing scheme for historical concept lookup')
  })

  test('throws when the direct published-uuid lookup arguments are missing', async () => {
    await expect(redisPathStore.getPublishedConceptByUuid({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing uuid for published concept lookup')

    await expect(redisPathStore.getPublishedConceptByUuid({
      uuid: 'uuid-1'
    })).rejects.toThrow('Missing scheme for published concept lookup')
  })
})
