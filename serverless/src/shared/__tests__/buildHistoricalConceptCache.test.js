import { Readable } from 'stream'

import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import {
  afterEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { buildHistoricalConceptCache } from '../buildHistoricalConceptCache'
import { getRedisClient } from '../redisCacheStore'

const mockFullPathProcessToCache = vi.fn()
const mockShortNameProcessToCache = vi.fn()
const mockSAdd = vi.fn()
const mockSMembers = vi.fn()

vi.mock('../conceptForFullPathCacheBuilder', () => ({
  ConceptForFullPathCacheBuilder: vi.fn(() => ({
    processToCache: mockFullPathProcessToCache
  }))
}))

vi.mock('../conceptForShortNameCacheBuilder', () => ({
  ConceptForShortNameCacheBuilder: vi.fn(() => ({
    processToCache: mockShortNameProcessToCache
  }))
}))

const mockS3Send = vi.fn()

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/shared/awsClients', () => ({
  getS3Client: vi.fn(() => ({
    send: mockS3Send
  }))
}))

vi.mock('../redisCacheStore', () => ({
  getRedisClient: vi.fn(() => Promise.resolve({
    sAdd: mockSAdd,
    sMembers: mockSMembers
  }))
}))

describe('buildHistoricalConceptCache', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mockS3Send.mockReset()
    mockSAdd.mockReset()
    mockSMembers.mockReset()
    mockSMembers.mockResolvedValue([])
    mockSAdd.mockResolvedValue(1)
    mockFullPathProcessToCache.mockResolvedValue({
      attemptedCount: 1,
      writtenCount: 1,
      failedCount: 0,
      skipped: false
    })

    mockShortNameProcessToCache.mockResolvedValue({
      attemptedCount: 1,
      writtenCount: 1,
      failedCount: 0,
      skipped: false
    })
  })

  test('throws an error if no bucket name is provided', async () => {
    await expect(buildHistoricalConceptCache()).rejects.toThrow(
      'An S3 bucket name is required to build the cache.'
    )
  })

  test('throws an error when redis is unavailable', async () => {
    vi.mocked(getRedisClient).mockResolvedValueOnce(null)

    await expect(buildHistoricalConceptCache('test-bucket')).rejects.toThrow(
      'Redis is required to build the historical concept cache.'
    )
  })

  test('should find and process all CSV files using the correct builder', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '2.0/') {
        return Promise.resolve({ Contents: [{ Key: '2.0/platforms.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('full-path-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '2.0/platforms.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('short-name-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    const result = await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockFullPathProcessToCache).toHaveBeenCalledWith('full-path-content', { scheme: 'sciencekeywords' })
    expect(mockShortNameProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockShortNameProcessToCache).toHaveBeenCalledWith('short-name-content', { scheme: 'platforms' })
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

  test('handles cases where no version directories are found', async () => {
    mockS3Send.mockResolvedValue({ CommonPrefixes: [] })

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  test('handles cases where no CSV files are found', async () => {
    mockS3Send
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.eio/' }] })
      .mockResolvedValueOnce({ Contents: [] })

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  test('should skip CSV files for unrecognized schemes', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({
          Contents: [
            { Key: '1.0/sciencekeywords.csv' },
            { Key: '1.0/unknown.csv' }
          ]
        })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('valid-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockFullPathProcessToCache).toHaveBeenCalledWith('valid-content', { scheme: 'sciencekeywords' })
    expect(mockS3Send).toHaveBeenCalledTimes(3)
  })

  test('should throw an error if processing a file fails', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.reject(new Error('S3 Download Failed'))
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).rejects.toThrow(
      'Failed to process 1 of 1 CSV files. Historical cache must include all archived versions.'
    )

    expect(mockSAdd).not.toHaveBeenCalled()
  })

  test('should skip non-CSV files when listing files', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({
          Contents: [
            { Key: '1.0/sciencekeywords.csv' },
            { Key: '1.0/readme.txt' },
            { Key: '1.0/metadata.json' },
            { Key: '1.0/platforms.csv' }
          ]
        })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('csv-content-1')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/platforms.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('csv-content-2')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockShortNameProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockS3Send).toHaveBeenCalledTimes(4)
  })

  test('should skip historical versions already marked as built in Redis', async () => {
    mockSMembers.mockResolvedValue(['1.0'])

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '2.0/') {
        return Promise.resolve({ Contents: [{ Key: '2.0/platforms.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '2.0/platforms.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('short-name-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockShortNameProcessToCache).toHaveBeenCalledWith('short-name-content', { scheme: 'platforms' })
    expect(mockSAdd).toHaveBeenCalledTimes(1)
    expect(mockSAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '2.0')
  })

  test('continues when reading the built-version marker set fails', async () => {
    mockSMembers.mockRejectedValueOnce(new Error('redis read failed'))

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/platforms.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/platforms.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('short-name-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })
  })

  test('returns early when all historical versions are already marked as built', async () => {
    mockSMembers.mockResolvedValue(['1.0', '2.0'])

    mockS3Send.mockResolvedValueOnce({
      CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }]
    })

    await expect(buildHistoricalConceptCache('test-bucket')).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 0,
      processedFileCount: 0,
      markedVersionCount: 0
    })

    expect(mockS3Send).toHaveBeenCalledTimes(1)
  })

  test('should throw an error if listing CSV files in a directory fails', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '2.0/') {
        return Promise.reject(new Error('Access Denied'))
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).rejects.toThrow(
      'Failed to list CSV files in 1 version directories. Historical cache must include all versions.'
    )

    expect(mockSAdd).toHaveBeenCalledTimes(1)
    expect(mockSAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '1.0')
  })

  test('should not mark a version as built when Redis caching is incomplete for a file', async () => {
    mockFullPathProcessToCache.mockResolvedValueOnce({
      attemptedCount: 1,
      writtenCount: 0,
      failedCount: 1,
      skipped: false
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('valid-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).rejects.toThrow(
      'Failed to process 1 of 1 CSV files. Historical cache must include all archived versions.'
    )

    expect(mockSAdd).not.toHaveBeenCalled()
  })

  test('throws detailed listing errors when no pending version can produce a valid CSV file list', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.reject(new Error('Access Denied'))
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).rejects.toThrow(
      'Failed to list CSV files in 1 version directories. Historical cache must include all versions.'
    )

    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  test('skips writing a built marker for versions that have no valid CSV files', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/unknown.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '2.0/') {
        return Promise.resolve({ Contents: [{ Key: '2.0/platforms.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '2.0/platforms.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('short-name-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 2,
      pendingVersionCount: 2,
      processedFileCount: 1,
      markedVersionCount: 1
    })

    expect(mockSAdd).toHaveBeenCalledTimes(1)
    expect(mockSAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '2.0')
  })

  test('continues when writing a built-version marker fails', async () => {
    mockSAdd.mockRejectedValueOnce(new Error('redis write failed'))

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/platforms.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/platforms.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('short-name-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).resolves.toEqual({
      cacheReady: true,
      totalVersionCount: 1,
      pendingVersionCount: 1,
      processedFileCount: 1,
      markedVersionCount: 1
    })
  })

  test('should throw when a cache builder reports Redis writes were skipped', async () => {
    mockFullPathProcessToCache.mockResolvedValueOnce({
      attemptedCount: 0,
      writtenCount: 0,
      failedCount: 0,
      skipped: true
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('valid-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).rejects.toThrow(
      'Failed to process 1 of 1 CSV files. Historical cache must include all archived versions.'
    )

    expect(mockSAdd).not.toHaveBeenCalled()
  })

  test('should throw an error with details when multiple files fail to process', async () => {
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({
          Contents: [
            { Key: '1.0/sciencekeywords.csv' },
            { Key: '1.0/platforms.csv' }
          ]
        })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.reject(new Error('Download Failed'))
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/platforms.csv') {
        return Promise.reject(new Error('Timeout'))
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await expect(buildHistoricalConceptCache('test-bucket')).rejects.toThrow(
      'Failed to process 2 of 2 CSV files. Historical cache must include all archived versions.'
    )
  })
})
