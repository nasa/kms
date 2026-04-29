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

const mockProcessToCache = vi.fn()

vi.mock('../uuidCacheBuilder', () => ({
  UuidCacheBuilder: vi.fn(() => ({
    processToCache: mockProcessToCache
  }))
}))

const mockS3Send = vi.fn()

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

  it('should find and process all CSV files in the bucket', async () => {
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
        return Promise.resolve({ Contents: [{ Key: '1.0/file1.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock ListObjectsV2Command for files in '2.0/'
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof ListObjectsV2Command && command.input.Prefix === '2.0/') {
        return Promise.resolve({ Contents: [{ Key: '2.0/file2.csv' }] })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand for file1.csv
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '1.0/file1.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('csv-content-1')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    // Mock GetObjectCommand for file2.csv
    mockS3send.mockImplementationOnce((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === '2.0/file2.csv') {
        return Promise.resolve({ Body: Readable.from([Buffer.from('csv-content-2')]) })
      }

      return Promise.reject(new Error('Unexpected S3 command'))
    })

    await buildUuidCache('test-bucket')

    expect(mockProcessToCache).toHaveBeenCalledTimes(2)
    expect(mockProcessToCache).toHaveBeenCalledWith('csv-content-1')
    expect(mockProcessToCache).toHaveBeenCalledWith('csv-content-2')
  })

  it('handles cases where no version directories are found', async () => {
    mockS3Send.mockResolvedValue({ CommonPrefixes: [] })
    await buildUuidCache('test-bucket')
    expect(mockProcessToCache).not.toHaveBeenCalled()
  })

  it('handles cases where no CSV files are found', async () => {
    mockS3Send
      .mockResolvedValueOnce({ CommonPrefixes: [{ Prefix: '1.0/' }] })
      .mockResolvedValueOnce({ Contents: [] }) // No files in the directory

    await buildUuidCache('test-bucket')
    expect(mockProcessToCache).not.toHaveBeenCalled()
  })
})
