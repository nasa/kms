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
  it,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { handler } from '../handler'

// Mock dependencies
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@aws-sdk/client-s3')

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

    sparqlRequest.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<rdf>Test RDF Data</rdf>')
    })

    S3Client.prototype.send = vi.fn().mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('when initiating export process', () => {
    it('should return immediately with a 202 status', async () => {
      const result = await handler({ version: 'published' })

      expect(result.statusCode).toBe(202)
      expect(JSON.parse(result.body).message).toBe('RDF export process initiated for version published')
    })

    it('should use default version if not provided', async () => {
      const result = await handler({})

      expect(result.statusCode).toBe(202)
      expect(JSON.parse(result.body).message).toBe('RDF export process initiated for version published')
    })
  })

  describe('when export process runs', () => {
    it('should successfully export RDF data to S3', async () => {
      await handler({ version: 'published' })

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/statements?version=published',
        accept: 'application/rdf+xml',
        version: 'published'
      })

      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand))
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('RDF data for version published exported successfully'))
    })

    it('should create S3 bucket if it does not exist', async () => {
      S3Client.prototype.send.mockRejectedValueOnce({ name: 'NotFound' })

      await handler({ version: 'published' })

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(CreateBucketCommand))
    })

    it('should handle S3 upload failure', async () => {
      S3Client.prototype.send.mockResolvedValueOnce({}) // HeadBucketCommand
      S3Client.prototype.send.mockRejectedValueOnce(new Error('S3 upload failed')) // PutObjectCommand

      await handler({ version: 'published' })

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(console.error).toHaveBeenCalledWith(
        'Error in export process:',
        expect.objectContaining({
          message: 'S3 upload failed'
        })
      )
    })

    it('should handle unexpected S3 errors', async () => {
      S3Client.prototype.send.mockRejectedValueOnce(new Error('Unexpected S3 error'))

      await handler({ version: 'published' })

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(console.error).toHaveBeenCalledWith(
        'Error in export process:',
        expect.objectContaining({
          message: 'Unexpected S3 error'
        })
      )
    })

    it('should handle sparqlRequest HTTP error', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 503
      })

      await handler({ version: 'published' })

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(console.error).toHaveBeenCalledWith(
        'Error in export process:',
        expect.objectContaining({
          message: 'HTTP error! status: 503'
        })
      )
    })
  })

  describe('Configuration and settings', () => {
    it('should use default bucket name if RDF_BUCKET_NAME is not set', async () => {
      delete process.env.RDF_BUCKET_NAME

      await handler({ version: 'published' })

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'kms-rdf-backup' })
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'kms-rdf-backup',
        Key: expect.stringMatching(/^published\/\d{4}\/\d{2}\/\d{2}\/rdf\.xml$/),
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })

    it('should set correct ContentType for S3 upload', async () => {
      await handler({ version: 'published' })

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'test-bucket',
        Key: expect.stringMatching(/^published\/\d{4}\/\d{2}\/\d{2}\/rdf\.xml$/),
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })
  })
})
