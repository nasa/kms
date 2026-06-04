import { Readable } from 'stream'

import { getS3Client } from '@/shared/awsClients'
import { getApplicationConfig } from '@/shared/getConfig'

import { getRedisClient } from '../../redisCacheStore'
import { rebuildHistoricalConceptCache } from '../rebuildHistoricalConceptCache'

vi.mock('@/shared/awsClients', () => ({
  getS3Client: vi.fn()
}))

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('../../redisCacheStore', () => ({
  getRedisClient: vi.fn()
}))

const createContext = ({
  send = vi.fn(),
  redisClient = {
    sAdd: vi.fn().mockResolvedValue(1),
    sMembers: vi.fn().mockResolvedValue([]),
    mSet: vi.fn().mockResolvedValue('OK')
  },
  redisClientProvider,
  s3ClientProvider
} = {}) => ({
  redisClientProvider: redisClientProvider || (async () => redisClient),
  s3ClientProvider: s3ClientProvider || (() => ({ send }))
})

describe('rebuildHistoricalConceptCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApplicationConfig).mockReturnValue({ env: 'sit' })
    delete process.env.RDF_BUCKET_NAME
  })

  afterEach(() => {
    delete process.env.RDF_BUCKET_NAME
  })

  test('uses the default context and RDF_BUCKET_NAME from the environment', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'
    const send = vi.fn().mockResolvedValue({ })
    const redisClient = {
      sAdd: vi.fn(),
      sMembers: vi.fn().mockResolvedValue([]),
      mSet: vi.fn()
    }

    vi.mocked(getS3Client).mockReturnValue({ send })
    vi.mocked(getRedisClient).mockResolvedValue(redisClient)

    await expect(rebuildHistoricalConceptCache()).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 0,
      pendingVersionCount: 0,
      processedFileCount: 0,
      markedVersionCount: 0
    })

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        Bucket: 'test-bucket'
      })
    }))
  })

  test('throws an error when redis is unavailable while rebuilding the historical cache', async () => {
    await expect(rebuildHistoricalConceptCache(createContext({
      redisClientProvider: async () => null
    }))).rejects.toThrow('Redis is required to build the historical concept cache.')
  })

  test('throws when the historical rebuild bucket cannot be resolved from config', async () => {
    vi.mocked(getApplicationConfig).mockReturnValue({ env: undefined })

    await expect(rebuildHistoricalConceptCache(createContext()))
      .rejects.toThrow('RDF bucket name is required to rebuild the historical cache')
  })

  test('finds and processes supported csv files through the historical cache rebuild flow', async () => {
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

    const result = await rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: mockSAdd,
        sMembers: mockSMembers,
        mSet: mockMSet
      })
    }))

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

  test('handles missing version directories and missing csv listings as empty collections', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const noVersionsResult = await rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({
        send: vi.fn().mockResolvedValue({})
      })
    }))

    expect(noVersionsResult).toEqual({
      cacheReady: true,
      totalVersionCount: 0,
      pendingVersionCount: 0,
      processedFileCount: 0,
      markedVersionCount: 0
    })

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({})

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send })
    }))).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 0,
      markedVersionCount: 0
    })
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

    const result = await rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn().mockResolvedValue(1),
        sMembers: vi.fn().mockResolvedValue(['1.0']),
        mSet: vi.fn().mockResolvedValue('OK')
      })
    }))

    expect(result).toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })
  })

  test('continues when reading the built historical version marker set fails', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/platforms.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Class","Type","Short_Name","Long_Name","UUID"
"Platforms","Space-based Platforms","Earth Observation Satellites","AQUA","Aqua satellite","uuid-1"`)])
      })

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn().mockResolvedValue(1),
        sMembers: vi.fn().mockRejectedValue(new Error('redis read failed')),
        mSet: vi.fn().mockResolvedValue('OK')
      })
    }))).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })
  })

  test('continues when writing a built-version marker fails', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)])
      })

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn().mockRejectedValue(new Error('marker write failed')),
        sMembers: vi.fn().mockResolvedValue([]),
        mSet: vi.fn().mockResolvedValue('OK')
      })
    }))).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })
  })

  test('returns early when all historical versions are already marked as built', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn().mockResolvedValueOnce({
      CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }]
    })

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => ({
        sAdd: vi.fn().mockResolvedValue(1),
        sMembers: vi.fn().mockResolvedValue(['1.0', '2.0']),
        mSet: vi.fn().mockResolvedValue('OK')
      })
    }))).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 0,
      processedFileCount: 0,
      markedVersionCount: 0
    })
  })

  test('does not write a built-version marker when the normalized version is blank', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '/sciencekeywords.csv' }] })
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

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => redisClient
    }))).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })

    expect(redisClient.sAdd).not.toHaveBeenCalled()
  })

  test('treats undefined version prefixes as blank version directories', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: undefined }] })
      .mockResolvedValueOnce({})

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send })
    }))).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 0,
      markedVersionCount: 0
    })
  })

  test('skips version markers for directories that contain no valid csv files when other versions succeed', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/readme.txt' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '2.0/platforms.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Class","Type","Short_Name","Long_Name","UUID"
"Platforms","Space-based Platforms","Earth Observation Satellites","AQUA","Aqua satellite","uuid-2"`)])
      })

    const redisClient = {
      sAdd: vi.fn().mockResolvedValue(1),
      sMembers: vi.fn().mockResolvedValue([]),
      mSet: vi.fn().mockResolvedValue('OK')
    }

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send }),
      redisClientProvider: async () => redisClient
    }))).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 2,
      processedFileCount: 1,
      markedVersionCount: 1
    })

    expect(redisClient.sAdd).toHaveBeenCalledTimes(1)
    expect(redisClient.sAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '2.0')
  })

  test('throws detailed errors when listing version directories fails without an error message', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockRejectedValueOnce({})

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send })
    }))).rejects.toThrow(
      'Failed to list CSV files in 1 version directories. Historical cache must include all versions. Errors: Directory 1.0/: Unknown error'
    )
  })

  test('throws list failures after processing other valid versions', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      .mockRejectedValueOnce({})
      .mockResolvedValueOnce({ Contents: [{ Key: '2.0/sciencekeywords.csv' }] })
      .mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-2"`)])
      })

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send })
    }))).rejects.toThrow(
      'Failed to list CSV files in 1 version directories. Historical cache must include all versions. Errors: Directory 1.0/: Unknown error'
    )
  })

  test('throws detailed errors when processing csv files fails without an error message', async () => {
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    const send = vi.fn()
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      .mockRejectedValueOnce({})

    await expect(rebuildHistoricalConceptCache(createContext({
      s3ClientProvider: () => ({ send })
    }))).rejects.toThrow(
      'Failed to process 1 of 1 CSV files. Historical cache must include all archived versions. Failed files: 1.0/sciencekeywords.csv: Unknown error'
    )
  })
})
