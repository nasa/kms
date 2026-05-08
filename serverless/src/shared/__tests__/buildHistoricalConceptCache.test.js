import { Readable } from 'stream'

import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { buildHistoricalConceptCache } from '../buildHistoricalConceptCache'

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

  it('throws an error if no bucket name is provided', async () => {
    await expect(buildHistoricalConceptCache()).rejects.toThrow(
      'An S3 bucket name is required to build the cache.'
    )
  })

  it('should find and process all CSV files using the correct builder', async () => {
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

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockFullPathProcessToCache).toHaveBeenCalledWith('full-path-content', { scheme: 'sciencekeywords' })
    expect(mockShortNameProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockShortNameProcessToCache).toHaveBeenCalledWith('short-name-content', { scheme: 'platforms' })
    expect(mockSAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '1.0')
    expect(mockSAdd).toHaveBeenCalledWith('kms:historical_concept:versions:built:v1', '2.0')
  })

  it('handles cases where no version directories are found', async () => {
    mockS3Send.mockResolvedValue({ CommonPrefixes: [] })

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  it('handles cases where no CSV files are found', async () => {
    mockS3Send
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.eio/' }] })
      .mockResolvedValueOnce({ Contents: [] })

    await buildHistoricalConceptCache('test-bucket')

    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  it('should skip CSV files for unrecognized schemes', async () => {
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

  it('should throw an error if processing a file fails', async () => {
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

  it('should skip non-CSV files when listing files', async () => {
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

  it('should skip historical versions already marked as built in Redis', async () => {
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

  it('should throw an error if listing CSV files in a directory fails', async () => {
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

  it('should not mark a version as built when Redis caching is incomplete for a file', async () => {
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

  it('should throw an error with details when multiple files fail to process', async () => {
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
