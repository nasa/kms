import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'

// Mock dependencies
vi.mock('@aws-sdk/client-s3')
vi.mock('@/shared/downloadConcepts')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getVersionMetadata')
vi.mock('@/shared/logger')
vi.mock('@/shared/getConfig')

describe('exportPublishSchemeCsvToS3', () => {
  beforeEach(() => {
    // Use fake timers to control setTimeout used in the delay function
    vi.useFakeTimers()
    vi.resetModules()
    vi.resetAllMocks()

    // Mock S3Client's send method globally
    S3Client.prototype.send = vi.fn().mockResolvedValue({})

    // Mock logger methods to prevent actual logging during tests
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})

    // Default successful mocks for dependencies
    getApplicationConfig.mockReturnValue({ env: 'sit' })
    getVersionMetadata.mockResolvedValue({ versionName: 'v22.1' })
    getConceptSchemeDetails.mockResolvedValue([
      { notation: 'SCHEME1' },
      { notation: 'SCHEME2' }
    ])

    // Mocking resolved values for each download call
    downloadConcepts.mockImplementation(async ({ conceptScheme }) => {
      if (conceptScheme === 'SCHEME1') return 'csv,data,for,scheme1'
      if (conceptScheme === 'SCHEME2') return 'csv,data,for,scheme2'

      return ''
    })
  })

  afterEach(() => {
    // Restore real timers after each test
    vi.useRealTimers()
  })

  test('should successfully export CSVs for all published schemes', async () => {
    const { exportPublishSchemeCsvToS3 } = await import('../exportPublishSchemeCsvToS3')

    await Promise.all([exportPublishSchemeCsvToS3(), vi.runAllTimersAsync()])

    // Verify initial setup calls
    expect(getVersionMetadata).toHaveBeenCalledWith('published')
    expect(getConceptSchemeDetails).toHaveBeenCalledWith({ version: 'published' })

    // Verify CSV download for each scheme
    expect(downloadConcepts).toHaveBeenCalledTimes(2)
    expect(downloadConcepts).toHaveBeenCalledWith({
      conceptScheme: 'SCHEME1',
      format: 'csv',
      version: 'published'
    })

    expect(downloadConcepts).toHaveBeenCalledWith({
      conceptScheme: 'SCHEME2',
      format: 'csv',
      version: 'published'
    })

    // Verify S3 upload for each scheme
    const S3ClientMock = vi.mocked(S3Client)
    const s3SendMock = S3ClientMock.mock.results[0].value.send
    expect(s3SendMock).toHaveBeenCalledTimes(2)
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'kms-rdf-backup-sit',
      Key: 'v22.1/SCHEME1.csv',
      Body: 'csv,data,for,scheme1',
      ContentType: 'text/csv'
    })

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'kms-rdf-backup-sit',
      Key: 'v22.1/SCHEME2.csv',
      Body: 'csv,data,for,scheme2',
      ContentType: 'text/csv'
    })

    // Verify logging
    expect(logger.info).toHaveBeenCalledWith('Exporting published CSVs for version: v22.1')
    expect(logger.info).toHaveBeenCalledWith('Uploading SCHEME1.csv to s3://kms-rdf-backup-sit/v22.1/SCHEME1.csv')
    expect(logger.info).toHaveBeenCalledWith('Finished exporting all published scheme CSVs to S3.')
  })

  test('should log a warning and exit if no schemes are found', async () => {
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([])

    const { exportPublishSchemeCsvToS3 } = await import('../exportPublishSchemeCsvToS3')

    await Promise.all([exportPublishSchemeCsvToS3(), vi.runAllTimersAsync()])

    expect(logger.warn).toHaveBeenCalledWith('No published concept schemes found to export.')
    expect(downloadConcepts).not.toHaveBeenCalled()
    const S3ClientMock = vi.mocked(S3Client)
    if (S3ClientMock.mock.results[0]) {
      const s3SendMock = S3ClientMock.mock.results[0].value.send
      expect(s3SendMock).not.toHaveBeenCalled()
    }
  })

  test('should throw an error if versionName cannot be determined', async () => {
    vi.mocked(getVersionMetadata).mockResolvedValue({ versionName: null })

    const { exportPublishSchemeCsvToS3 } = await import('../exportPublishSchemeCsvToS3')

    await expect(exportPublishSchemeCsvToS3()).rejects.toThrow('Could not determine published version name.')
    expect(logger.error).toHaveBeenCalledWith('Error in exportPublishSchemeCsvToS3: Could not determine published version name.')
  })

  test('should throw an error if getVersionMetadata rejects', async () => {
    vi.mocked(getVersionMetadata).mockRejectedValue(new Error('API failure'))

    const { exportPublishSchemeCsvToS3 } = await import('../exportPublishSchemeCsvToS3')

    await expect(exportPublishSchemeCsvToS3()).rejects.toThrow('API failure')
    expect(logger.error).toHaveBeenCalledWith('Error in exportPublishSchemeCsvToS3: API failure')
  })

  test('should continue processing other schemes if one fails', async () => {
    vi.mocked(downloadConcepts).mockImplementation(async ({ conceptScheme }) => {
      if (conceptScheme === 'SCHEME1') throw new Error('Download failed')
      if (conceptScheme === 'SCHEME2') return 'csv,data,for,scheme2'

      return ''
    })

    const { exportPublishSchemeCsvToS3 } = await import('../exportPublishSchemeCsvToS3')

    await Promise.all([exportPublishSchemeCsvToS3(), vi.runAllTimersAsync()])

    expect(logger.error).toHaveBeenCalledWith('Failed to process scheme SCHEME1: Download failed')
    // Check that the second scheme was still processed successfully
    expect(downloadConcepts).toHaveBeenCalledTimes(2)

    const S3ClientMock = vi.mocked(S3Client)
    const s3SendMock = S3ClientMock.mock.results[0].value.send
    expect(s3SendMock).toHaveBeenCalledTimes(1)
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'kms-rdf-backup-sit',
      Key: 'v22.1/SCHEME2.csv',
      Body: 'csv,data,for,scheme2',
      ContentType: 'text/csv'
    })

    expect(logger.info).toHaveBeenCalledWith('Finished exporting all published scheme CSVs to S3.')
  })

  test('should construct bucket name based on environment from application config', async () => {
    vi.mocked(getApplicationConfig).mockReturnValue({ env: 'dev' })

    const { exportPublishSchemeCsvToS3 } = await import('../exportPublishSchemeCsvToS3')

    await Promise.all([exportPublishSchemeCsvToS3(), vi.runAllTimersAsync()])

    expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'kms-rdf-backup-dev'
    }))
  })
})
