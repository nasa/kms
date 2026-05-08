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
import { logger } from '../logger'

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
    mockS3Send.mockReset() // Reset the shared mock between tests
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
    await expect(buildHistoricalConceptCache()).rejects.toThrow('An S3 bucket name is required to build the cache.')
  })

  it('should find and process all CSV files using the correct builder', async () => {
    const mockS3send = mockS3Send

    // Mock ListObjectsV2Command for directories
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }, { Prefix: '2.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock ListObjectsV2Command for files in '1.0/'
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock ListObjectsV2Command for files in '2.0/'
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '2.0/') {
        return Promise.resolve({ Contents: [{ Key: '2.0/platforms.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand for sciencekeywords.csv
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('full-path-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand for platforms.csv
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '2.0/platforms.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('short-name-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildHistoricalConceptCache('test-bucket')

    // Verify the full path builder was called correctly
    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockFullPathProcessToCache).toHaveBeenCalledWith('full-path-content', { scheme: 'sciencekeywords' })

    // Verify the short name builder was called correctly
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
      .mockResolvedValueOnce({ Contents: [] }) // No files in the directory

    await buildHistoricalConceptCache('test-bucket')
    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  it('should skip CSV files for unrecognized schemes', async () => {
    // Mock ListObjectsV2Command for directories
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock ListObjectsV2Command for files in '1.0/' - includes both valid and invalid schemes
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({
          Contents: [
            { Key: '1.0/sciencekeywords.csv' },
            { Key: '1.0/unknown.csv' } // This should be filtered out
          ]
        })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand for sciencekeywords.csv only (unknown.csv should not be downloaded)
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('valid-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildHistoricalConceptCache('test-bucket')

    // Should only process the valid scheme
    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockFullPathProcessToCache).toHaveBeenCalledWith('valid-content', { scheme: 'sciencekeywords' })

    // Should not attempt to download unknown.csv
    expect(mockS3Send).toHaveBeenCalledTimes(3) // ListDirs + listFiles + getObject for sciencekeywords only
  })

  it('should log an error if processing a file fails', async () => {
    // Mock ListObjectsV2Command for directories
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock ListObjectsV2Command for files in '1.0/'
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({ Contents: [{ Key: '1.0/sciencekeywords.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand to fail
    const mockError = new Error('S3 Download Failed')
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/sciencekeywords.csv') {
        return Promise.reject(mockError)
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildHistoricalConceptCache('test-bucket')

    expect(logger.error).toHaveBeenCalledWith('Failed to process file [1.0/sciencekeywords.csv]: S3 Download Failed')
    expect(mockSAdd).not.toHaveBeenCalled()
  })

  it('should skip non-CSV files when listing files', async () => {
    // Mock ListObjectsV2Command for directories
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Delimiter === '/') {
        return Promise.resolve({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock ListObjectsV2Command for files in '1.0/' - includes CSV and non-CSV files
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '1.0/') {
        return Promise.resolve({
          Contents: [
            { Key: '1.0/sciencekeywords.csv' },
            { Key: '1.0/readme.txt' }, // Non-CSV file - should be filtered
            { Key: '1.0/metadata.json' }, // Non-CSV file - should be filtered
            { Key: '1.0/platforms.csv' }
          ]
        })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand for CSV files only
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

    // Should process both CSV files
    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockShortNameProcessToCache).toHaveBeenCalledTimes(1)

    // Should not attempt to download non-CSV files
    expect(mockS3Send).toHaveBeenCalledTimes(4) // ListDirs + listFiles + getObject×2 for CSV files only
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

    await buildHistoricalConceptCache('test-bucket')

    expect(mockSAdd).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to process file [1.0/sciencekeywords.csv]: Redis cache write incomplete for [1.0/sciencekeywords.csv] failedCount=1'
    )
  })
})
