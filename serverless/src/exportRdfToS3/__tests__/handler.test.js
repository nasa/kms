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
import { sparqlRequest } from '@/shared/sparqlRequest'

import { handler } from '../handler'

// Mock dependencies
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@aws-sdk/client-s3')

describe('exportRdfToS3 handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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

  describe('when successful', () => {
    test('should successfully export RDF data to S3', async () => {
      S3Client.prototype.send.mockResolvedValueOnce({}) // HeadBucketCommand
      S3Client.prototype.send.mockResolvedValueOnce({}) // PutObjectCommand

      const result = await handler()

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe('RDF data exported successfully')
      expect(JSON.parse(result.body).s3Key).toMatch(/^\d{4}\/\d{2}\/\d{2}\/rdf\.xml$/)
      expect(S3Client.prototype.send).toHaveBeenCalledTimes(2)
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand))
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
    })

    test('should create S3 bucket if it does not exist', async () => {
      S3Client.prototype.send.mockRejectedValueOnce({ name: 'NotFound' }) // HeadBucketCommand
      S3Client.prototype.send.mockResolvedValueOnce({}) // CreateBucketCommand
      S3Client.prototype.send.mockResolvedValueOnce({}) // PutObjectCommand

      const result = await handler()

      expect(result.statusCode).toBe(200)
      expect(S3Client.prototype.send).toHaveBeenCalledTimes(3)
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand))
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(CreateBucketCommand))
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
    })
  })

  describe('when unsuccessful', () => {
    test('should handle sparqlRequest failure', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await handler()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error exporting RDF data')
      expect(S3Client.prototype.send).not.toHaveBeenCalled()
    })

    test('should handle S3 upload failure', async () => {
      S3Client.prototype.send.mockResolvedValueOnce({}) // HeadBucketCommand
      S3Client.prototype.send.mockRejectedValueOnce(new Error('S3 upload failed')) // PutObjectCommand

      const result = await handler()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error exporting RDF data')
      expect(S3Client.prototype.send).toHaveBeenCalledTimes(2)
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand))
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
    })

    test('should handle unexpected S3 errors', async () => {
      S3Client.prototype.send.mockRejectedValueOnce(new Error('Unexpected S3 error'))

      const result = await handler()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error exporting RDF data')
      expect(S3Client.prototype.send).toHaveBeenCalledTimes(1)
      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand))
    })
  })

  describe('Configuration and settings', () => {
    test('should use default bucket name if RDF_BUCKET_NAME is not set', async () => {
      delete process.env.RDF_BUCKET_NAME
      const sendMock = vi.fn().mockResolvedValue({})
      vi.spyOn(S3Client.prototype, 'send').mockImplementation(sendMock)

      await handler()

      expect(sendMock).toHaveBeenCalledTimes(2)

      const headBucketCall = sendMock.mock.calls[0][0]
      const putObjectCall = sendMock.mock.calls[1][0]

      expect(headBucketCall).toBeInstanceOf(HeadBucketCommand)
      expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'kms-rdf-backup' })

      expect(putObjectCall).toBeInstanceOf(PutObjectCommand)
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'kms-rdf-backup',
        Key: expect.stringMatching(/^\d{4}\/\d{2}\/\d{2}\/rdf\.xml$/),
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })

    test('should set correct ContentType for S3 upload', async () => {
      const sendMock = vi.fn().mockResolvedValue({})
      vi.spyOn(S3Client.prototype, 'send').mockImplementation(sendMock)

      await handler()

      expect(sendMock).toHaveBeenCalledTimes(2)

      const headBucketCall = sendMock.mock.calls[0][0]
      const putObjectCall = sendMock.mock.calls[1][0]

      console.log('HeadBucketCommand:', JSON.stringify(headBucketCall, null, 2))
      console.log('PutObjectCommand:', JSON.stringify(putObjectCall, null, 2))

      // Check HeadBucketCommand
      expect(headBucketCall).toBeInstanceOf(HeadBucketCommand)
      expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'test-bucket' })

      // Check PutObjectCommand
      expect(putObjectCall).toBeInstanceOf(PutObjectCommand)
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'test-bucket',
        Key: expect.stringMatching(/^\d{4}\/\d{2}\/\d{2}\/rdf\.xml$/),
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })
  })
})
