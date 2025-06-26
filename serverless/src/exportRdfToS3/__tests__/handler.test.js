import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { handler } from '../handler'

// Mock dependencies
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@aws-sdk/client-s3')
vi.mock('@/shared/getVersionMetadata')

describe('exportRdfToS3 handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.RDF_BUCKET_NAME = 'test-bucket'

    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'Content-Type': 'application/json' }
    })

    getVersionMetadata.mockReturnValue({ versionName: '21.4' })

    sparqlRequest.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<rdf>Test RDF Data</rdf>')
    })

    S3Client.prototype.send = vi.fn().mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('when export process runs', () => {
    test('should successfully export RDF data to S3', async () => {
      const result = await handler({ version: 'published' })

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe('RDF export process complete for version published')

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/statements',
        accept: 'application/rdf+xml',
        version: 'published'
      })

      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand))
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('RDF data for version published exported successfully'))
    })

    test('should use versionName as S3 key for published version', async () => {
      const result = await handler({ version: 'published' })

      expect(result.statusCode).toBe(200)
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'test-bucket',
        Key: '21.4/rdf.xml',
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })

    test('should use date-based S3 key for non-published versions', async () => {
      vi.setSystemTime(new Date('2023-06-01T12:00:00Z'))

      const result = await handler({ version: 'draft' })

      expect(result.statusCode).toBe(200)
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'draft/2023/06/01/rdf.xml',
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })

    test('should use default version if not provided', async () => {
      const result = await handler({})

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe('RDF export process complete for version published')
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Key: '21.4/rdf.xml'
      }))
    })

    test('should create S3 bucket if it does not exist', async () => {
      S3Client.prototype.send.mockRejectedValueOnce({ name: 'NotFound' })

      const result = await handler({ version: 'published' })

      expect(result.statusCode).toBe(200)
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(CreateBucketCommand))
    })

    test('should handle S3 upload failure', async () => {
      S3Client.prototype.send.mockResolvedValueOnce({}) // HeadBucketCommand
      S3Client.prototype.send.mockRejectedValueOnce(new Error('S3 upload failed')) // PutObjectCommand

      const result = await handler({ version: 'published' })

      expect(result.statusCode).toBe(500) // The handler catches the error and still returns 200
      expect(JSON.parse(result.body).message).toBe('Error in RDF export process')
      expect(console.error).toHaveBeenCalledWith(
        'Error in export process:',
        expect.objectContaining({
          message: 'S3 upload failed'
        })
      )
    })

    test('should handle unexpected S3 errors', async () => {
      S3Client.prototype.send.mockRejectedValueOnce(new Error('Unexpected S3 error'))

      const result = await handler({ version: 'published' })

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error in RDF export process')
      expect(console.error).toHaveBeenCalledWith(
        'Error in export process:',
        expect.objectContaining({
          message: 'Unexpected S3 error'
        })
      )
    })

    test('should handle sparqlRequest HTTP error', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 503
      })

      const result = await handler({ version: 'published' })

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error in RDF export process')
      expect(console.error).toHaveBeenCalledWith(
        'Error in export process:',
        expect.objectContaining({
          message: 'HTTP error! status: 503'
        })
      )
    })
  })

  describe('Configuration and settings', () => {
    test('should use default bucket name if RDF_BUCKET_NAME is not set', async () => {
      delete process.env.RDF_BUCKET_NAME

      await handler({ version: 'published' })

      expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'kms-rdf-backup' })
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'kms-rdf-backup',
        Key: '21.4/rdf.xml',
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })

    test('should set correct ContentType for S3 upload', async () => {
      await handler({ version: 'published' })

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'test-bucket',
        Key: '21.4/rdf.xml',
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })
  })
})
