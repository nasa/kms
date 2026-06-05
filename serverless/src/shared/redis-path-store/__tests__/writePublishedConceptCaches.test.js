import { getS3Client } from '@/shared/awsClients'
import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'

import { clearCachedByPrefix } from '../../redisCacheStore'
import { writePublishedConceptCaches } from '../writePublishedConceptCaches'

vi.mock('@/shared/awsClients', () => ({
  getS3Client: vi.fn()
}))

vi.mock('@/shared/downloadConcepts', () => ({
  downloadConcepts: vi.fn()
}))

vi.mock('@/shared/getConceptSchemeDetails', () => ({
  getConceptSchemeDetails: vi.fn()
}))

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn()
}))

vi.mock('@/shared/getVersionMetadata', () => ({
  getVersionMetadata: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../redisCacheStore', () => ({
  clearCachedByPrefix: vi.fn(),
  getRedisClient: vi.fn()
}))

vi.mock('../helpers/delay', () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}))

const createContext = ({
  send = vi.fn().mockResolvedValue({}),
  redisClient = {
    mSet: vi.fn().mockResolvedValue('OK')
  },
  redisClientProvider,
  s3ClientProvider
} = {}) => ({
  redisClientProvider: redisClientProvider || (async () => redisClient),
  s3ClientProvider: s3ClientProvider || (() => ({ send }))
})

describe('writePublishedConceptCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.mocked(getApplicationConfig).mockReturnValue({ env: 'sit' })
    vi.mocked(getVersionMetadata).mockResolvedValue({ versionName: 'v22.1' })
  })

  test('writes published concept caches and uploads matching csv snapshots', async () => {
    const send = vi.fn().mockResolvedValue({})
    const context = createContext({ s3ClientProvider: () => ({ send }) })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([
      { notation: 'SCHEME1' },
      { notation: 'SCHEME2' }
    ])

    vi.mocked(downloadConcepts)
      .mockResolvedValueOnce('csv,data,for,scheme1')
      .mockResolvedValueOnce('csv,data,for,scheme2')

    const result = await writePublishedConceptCaches(context)

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

  test('uses the default context and returns early when published schemes are missing', async () => {
    const send = vi.fn()

    vi.mocked(getS3Client).mockReturnValue({ send })
    vi.mocked(getConceptSchemeDetails).mockResolvedValue(null)

    await expect(writePublishedConceptCaches()).resolves.toEqual({
      versionName: 'v22.1',
      schemeCount: 0,
      uploadedCount: 0,
      cachedCount: 0,
      cacheReady: true,
      schemeResults: [],
      failedSchemes: []
    })

    expect(logger.warn).toHaveBeenCalledWith('No published concept schemes found to export.')
  })

  test('throws when the published export bucket cannot be resolved from config', async () => {
    vi.mocked(getApplicationConfig).mockReturnValue({ env: undefined })

    await expect(writePublishedConceptCaches(createContext()))
      .rejects.toThrow('Application environment is required to export published CSV snapshots')
  })

  test('throws when published csv export cannot determine a version name', async () => {
    vi.mocked(getVersionMetadata).mockResolvedValue({ versionName: null })

    await expect(writePublishedConceptCaches(createContext()))
      .rejects.toThrow('Could not determine published version name.')
  })

  test('skips scheme entries without a notation while still processing string scheme entries', async () => {
    const send = vi.fn().mockResolvedValue({})
    const context = createContext({ s3ClientProvider: () => ({ send }) })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([
      {},
      'sciencekeywords'
    ])

    vi.mocked(downloadConcepts).mockResolvedValue('csv-content')

    const result = await writePublishedConceptCaches(context)

    expect(downloadConcepts).toHaveBeenCalledTimes(1)
    expect(result.schemeResults).toHaveLength(1)
    expect(result.schemeResults[0]).toMatchObject({
      notation: 'sciencekeywords',
      skipped: false,
      cacheReady: true
    })
  })

  test('writes full-path published cache entries with both full-path and uuid keys', async () => {
    const redisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const context = createContext({ redisClient })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)

    vi.mocked(getConceptSchemeDetails).mockResolvedValue(['sciencekeywords'])

    const result = await writePublishedConceptCaches(context)

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:sciencekeywords:published_concept'
    })

    expect(redisClient.mSet).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      schemeCount: 1,
      uploadedCount: 1,
      cachedCount: 2,
      cacheReady: true
    })
  })

  test('writes short-name published cache entries with both short-name and uuid keys', async () => {
    const redisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const context = createContext({ redisClient })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Category","Class","Type","Short_Name","Long_Name","UUID"
"Platforms","Space-based Platforms","Earth Observation Satellites","AQUA","Aqua satellite","uuid-2"`)

    vi.mocked(getConceptSchemeDetails).mockResolvedValue(['platforms'])

    const result = await writePublishedConceptCaches(context)

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:platforms:published_concept'
    })

    expect(redisClient.mSet).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      schemeCount: 1,
      uploadedCount: 1,
      cachedCount: 2,
      cacheReady: true
    })
  })

  test('normalizes granuledataformat into the dataformat cache namespace', async () => {
    const redisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }
    const context = createContext({ redisClient })

    vi.mocked(downloadConcepts).mockResolvedValue(`"Version"
"Short_Name","Long_Name","UUID"
"NetCDF","","uuid-3"`)

    vi.mocked(getConceptSchemeDetails).mockResolvedValue(['granuledataformat'])

    const result = await writePublishedConceptCaches(context)

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:dataformat:published_concept'
    })

    expect(result).toMatchObject({
      schemeCount: 1,
      uploadedCount: 1,
      cachedCount: 2,
      cacheReady: true
    })
  })

  test('throws when published cache writing cannot use redis', async () => {
    const context = createContext({
      redisClient: null
    })

    vi.mocked(downloadConcepts).mockResolvedValue('csv-content')
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([{ notation: 'sciencekeywords' }])

    await expect(writePublishedConceptCaches(context))
      .rejects.toThrow('Failed to export CSV for schemes: sciencekeywords')

    expect(logger.warn).toHaveBeenCalledWith(
      '[publisher] Skipping published concept cache prime scheme=sciencekeywords reason=redis_unavailable'
    )

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to process scheme sciencekeywords: Published concept cache not ready for scheme=sciencekeywords reason=redis_unavailable'
    )
  })

  test('throws with aggregated failures when cache priming or upload cannot complete', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('S3 upload failed'))
    const context = createContext({ s3ClientProvider: () => ({ send }) })

    vi.mocked(getConceptSchemeDetails).mockResolvedValue([
      { notation: 'sciencekeywords' },
      { notation: 'platforms' }
    ])

    vi.mocked(downloadConcepts)
      .mockResolvedValueOnce(`"Version"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"`)
      .mockRejectedValueOnce(new Error('Download failed'))

    await expect(writePublishedConceptCaches(context))
      .rejects.toThrow('Failed to export CSV for schemes: platforms, sciencekeywords')

    expect(logger.error).toHaveBeenCalledWith(
      '[publisher] Failed to prime published cache for scheme platforms: Download failed'
    )

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to process scheme sciencekeywords: S3 upload failed'
    )
  })
})
