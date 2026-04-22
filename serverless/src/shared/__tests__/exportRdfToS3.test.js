import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { ensureBucketAndLifecycleRule } from '@/shared/ensureBucketAndLifeCycleRule'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { exportRdfToS3 } from '../exportRdfToS3'

// Mock dependencies
vi.mock('@/shared/sparqlRequest')
vi.mock('@aws-sdk/client-s3')
vi.mock('@/shared/getVersionMetadata')
vi.mock('@/shared/ensureBucketAndLifeCycleRule')
vi.mock('@/shared/getConfig')

describe('exportRdfToS3', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    getApplicationConfig.mockReturnValue({
      env: 'test',
      defaultResponseHeaders: { 'Content-Type': 'application/json' }
    })

    getVersionMetadata.mockReturnValue({ versionName: '21.4' })

    sparqlRequest.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<rdf>Test RDF Data</rdf>')
    })

    S3Client.prototype.send = vi.fn().mockResolvedValue({})
    ensureBucketAndLifecycleRule.mockResolvedValue()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('when export process runs', () => {
    test('should successfully export RDF data to S3 for published version', async () => {
      const result = await exportRdfToS3({ version: 'published' })

      expect(result.s3Key).toBe('21.4/rdf.xml')

      expect(ensureBucketAndLifecycleRule).toHaveBeenCalledWith(expect.any(S3Client), 'kms-rdf-backup-test', 30, 'draft/')

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/statements',
        accept: 'application/rdf+xml',
        version: 'published'
      })

      expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'kms-rdf-backup-test',
        Key: '21.4/rdf.xml',
        Body: '<rdf>Test RDF Data</rdf>',
        ContentType: 'application/rdf+xml'
      }))

      expect(console.log).toHaveBeenCalledWith('RDF data for version published exported successfully to 21.4/rdf.xml')
    })

    test('should use date-based S3 key for non-published versions', async () => {
      vi.setSystemTime(new Date('2023-06-01T12:00:00Z'))

      const result = await exportRdfToS3({ version: 'draft' })

      expect(result.s3Key).toBe('draft/2023/06/01/rdf.xml')

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'kms-rdf-backup-test',
        Key: 'draft/2023/06/01/rdf.xml',
        Body: expect.any(String),
        ContentType: 'application/rdf+xml'
      }))
    })

    test('should handle S3 upload failure', async () => {
      S3Client.prototype.send.mockRejectedValueOnce(new Error('S3 upload failed'))

      await expect(exportRdfToS3({ version: 'published' })).rejects.toThrow('S3 upload failed')
    })

    test('should handle sparqlRequest HTTP error', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 503
      })

      await expect(exportRdfToS3({ version: 'published' })).rejects.toThrow('HTTP error! status: 503')
      expect(console.log).toHaveBeenCalledWith('error fetching rdfxml for ', 'published')
    })

    test('should handle getVersionMetadata failure', async () => {
      getVersionMetadata.mockRejectedValue(new Error('Metadata fetch failed'))

      await expect(exportRdfToS3({ version: 'published' })).rejects.toThrow('Metadata fetch failed')
    })

    test('should handle ensureBucketAndLifecycleRule failure', async () => {
      ensureBucketAndLifecycleRule.mockRejectedValue(new Error('Bucket setup failed'))

      await expect(exportRdfToS3({ version: 'published' })).rejects.toThrow('Bucket setup failed')
    })
  })

  describe('Configuration and settings', () => {
    test('should set correct ContentType for S3 upload', async () => {
      await exportRdfToS3({ version: 'published' })

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        ContentType: 'application/rdf+xml'
      }))
    })

    test('should construct bucket name based on environment from application config', async () => {
      vi.mocked(getApplicationConfig).mockReturnValue({ env: 'dev' })
      await exportRdfToS3({ version: 'published' })

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'kms-rdf-backup-dev'
      }))
    })
  })
})
