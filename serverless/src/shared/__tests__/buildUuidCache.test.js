import { Readable } from 'stream'

import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { buildUuidCache } from '../buildUuidCache'
import { logger } from '../logger'

const mockFullPathProcessToCache = vi.fn()
const mockShortNameProcessToCache = vi.fn()

vi.mock('../uuidForFullPathCacheBuilder', () => ({
  UuidForFullPathCacheBuilder: vi.fn(() => ({
    processToCache: mockFullPathProcessToCache
  }))
}))

vi.mock('../uuidForShortNameCacheBuilder', () => ({
  UuidForShortNameCacheBuilder: vi.fn(() => ({
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

describe('buildUuidCache', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mockS3Send.mockReset() // Reset the shared mock between tests
  })

  it('throws an error if no bucket name is provided', async () => {
    await expect(buildUuidCache()).rejects.toThrow('An S3 bucket name is required to build the cache.')
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

    await buildUuidCache('test-bucket')

    // Verify the full path builder was called correctly
    expect(mockFullPathProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockFullPathProcessToCache).toHaveBeenCalledWith('full-path-content', { scheme: 'sciencekeywords' })

    // Verify the short name builder was called correctly
    expect(mockShortNameProcessToCache).toHaveBeenCalledTimes(1)
    expect(mockShortNameProcessToCache).toHaveBeenCalledWith('short-name-content', { scheme: 'platforms' })
  })

  it('handles cases where no version directories are found', async () => {
    mockS3Send.mockResolvedValue({ CommonPrefixes: [] })
    await buildUuidCache('test-bucket')
    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  it('handles cases where no CSV files are found', async () => {
    mockS3Send
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.eio/' }] })
      .mockResolvedValueOnce({ Contents: [] }) // No files in the directory

    await buildUuidCache('test-bucket')
    expect(mockFullPathProcessToCache).not.toHaveBeenCalled()
    expect(mockShortNameProcessToCache).not.toHaveBeenCalled()
  })

  it('should warn when no builder is found for a scheme', async () => {
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
        return Promise.resolve({ Contents: [{ Key: '1.0/unknown.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand for unknown.csv
    mockS3Send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/unknown.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('some-content')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildUuidCache('test-bucket')

    expect(logger.warn).toHaveBeenCalledWith('No cache builder found for scheme [unknown] in file [1.0/unknown.csv].')
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

    await buildUuidCache('test-bucket')

    expect(logger.error).toHaveBeenCalledWith('Failed to process file [1.0/sciencekeywords.csv]: S3 Download Failed')
  })
})
