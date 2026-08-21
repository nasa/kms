import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getS3Client } from '@/shared/awsClients'
import { exportRdfToS3 } from '@/shared/exportRdfToS3'
import { logger } from '@/shared/logger'

import { exportRdf } from '../handler'

vi.mock('@aws-sdk/client-s3')
vi.mock('@aws-sdk/s3-request-presigner')
vi.mock('@/shared/awsClients')
vi.mock('@/shared/exportRdfToS3')
vi.mock('@/shared/logger')

describe('exportRdf', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getS3Client).mockReturnValue({})
    vi.mocked(exportRdfToS3).mockResolvedValue({
      bucketName: 'kms-rdf-backup-test',
      s3Key: '21.4/rdf.xml.gz'
    })

    vi.mocked(getSignedUrl).mockResolvedValue('https://example.com/rdf.xml.gz')
  })

  test('exports the requested graph and returns its temporary download URL', async () => {
    const response = await exportRdf({
      queryStringParameters: {
        version: 'published'
      }
    })

    expect(exportRdfToS3).toHaveBeenCalledWith({
      version: 'published',
      archive: true
    })

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'kms-rdf-backup-test',
      Key: '21.4/rdf.xml.gz',
      ResponseContentDisposition: 'attachment; filename="kms-published-rdf.xml.gz"',
      ResponseContentType: 'application/gzip'
    })

    expect(getSignedUrl).toHaveBeenCalledWith(
      {},
      expect.any(GetObjectCommand),
      { expiresIn: 300 }
    )

    expect(response).toEqual(expect.objectContaining({
      statusCode: 200,
      body: JSON.stringify({
        version: 'published',
        downloadUrl: 'https://example.com/rdf.xml.gz',
        expiresIn: 300
      })
    }))
  })

  test('rejects a missing or unsupported version', async () => {
    const unsupportedResponse = await exportRdf({
      queryStringParameters: {
        version: 'invalid'
      }
    })
    const missingResponse = await exportRdf({})

    expect(unsupportedResponse.statusCode).toBe(400)
    expect(missingResponse.statusCode).toBe(400)
    expect(exportRdfToS3).not.toHaveBeenCalled()
  })

  test('returns an internal error when the export fails', async () => {
    vi.mocked(exportRdfToS3).mockRejectedValue(new Error('RDF4J unavailable'))

    const response = await exportRdf({
      queryStringParameters: {
        version: 'draft'
      }
    })

    expect(response.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-export] Failed to create draft RDF export, error=Error: RDF4J unavailable'
    )
  })
})
