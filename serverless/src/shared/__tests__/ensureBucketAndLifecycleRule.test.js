import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'

import { ensureBucketAndLifecycleRule } from '../ensureBucketAndLifeCycleRule'

describe('ensureBucketAndLifecycleRule', () => {
  test('should create bucket and set lifecycle rule if bucket does not exist', async () => {
    const mockS3Client = {
      send: vi.fn()
        .mockRejectedValueOnce({ name: 'NotFound' }) // HeadBucketCommand fails
        .mockResolvedValueOnce({}) // CreateBucketCommand succeeds
        .mockResolvedValueOnce({}) // PutBucketLifecycleConfigurationCommand succeeds
    }

    await ensureBucketAndLifecycleRule(mockS3Client, 'test-bucket', 30)

    expect(mockS3Client.send).toHaveBeenCalledTimes(3)
    expect(mockS3Client.send).toHaveBeenNthCalledWith(1, expect.any(HeadBucketCommand))
    expect(mockS3Client.send).toHaveBeenNthCalledWith(2, expect.any(CreateBucketCommand))
    expect(mockS3Client.send).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'test-bucket',
          LifecycleConfiguration: {
            Rules: [
              {
                ID: 'ExpireDraftFiles',
                Status: 'Enabled',
                Filter: {
                  Prefix: 'draft/'
                },
                Expiration: { Days: 30 }
              }
            ]
          }
        })
      })
    )
  })

  test('should only set lifecycle rule if bucket already exists', async () => {
    const mockS3Client = {
      send: vi.fn()
        .mockResolvedValueOnce({}) // HeadBucketCommand succeeds
        .mockResolvedValueOnce({}) // PutBucketLifecycleConfigurationCommand succeeds
    }

    await ensureBucketAndLifecycleRule(mockS3Client, 'test-bucket', 30)

    expect(mockS3Client.send).toHaveBeenCalledTimes(2)
    expect(mockS3Client.send).toHaveBeenNthCalledWith(1, expect.any(HeadBucketCommand))
    expect(mockS3Client.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'test-bucket',
          LifecycleConfiguration: {
            Rules: [
              {
                ID: 'ExpireDraftFiles',
                Status: 'Enabled',
                Filter: {
                  Prefix: 'draft/'
                },
                Expiration: { Days: 30 }
              }
            ]
          }
        })
      })
    )
  })

  test('should create bucket and set lifecycle rule when bucket does not exist', async () => {
    const mockS3Client = {
      send: vi.fn()
        .mockRejectedValueOnce({ name: 'NotFound' }) // HeadBucketCommand fails
        .mockResolvedValueOnce({}) // CreateBucketCommand succeeds
        .mockResolvedValueOnce({}) // PutBucketLifecycleConfigurationCommand succeeds
    }

    const bucketName = 'test-bucket'
    const daysUntilExpiration = 30

    await ensureBucketAndLifecycleRule(mockS3Client, bucketName, daysUntilExpiration)

    // Check that HeadBucketCommand was called
    expect(mockS3Client.send).toHaveBeenNthCalledWith(1, expect.any(HeadBucketCommand))

    // Check that CreateBucketCommand was called
    expect(mockS3Client.send).toHaveBeenNthCalledWith(2, expect.any(CreateBucketCommand))

    // Check that PutBucketLifecycleConfigurationCommand was called with correct parameters
    expect(mockS3Client.send).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        input: {
          Bucket: bucketName,
          LifecycleConfiguration: {
            Rules: [
              {
                ID: 'ExpireDraftFiles',
                Status: 'Enabled',
                Filter: {
                  Prefix: 'draft/'
                },
                Expiration: { Days: daysUntilExpiration }
              }
            ]
          }
        }
      })
    )

    // Check that the function was called exactly 3 times
    expect(mockS3Client.send).toHaveBeenCalledTimes(3)
  })

  test('should throw error if bucket creation fails', async () => {
    const mockS3Client = {
      send: vi.fn()
        .mockRejectedValueOnce({ name: 'NotFound' }) // HeadBucketCommand fails
        .mockRejectedValueOnce(new Error('Bucket creation failed')) // CreateBucketCommand fails
    }

    await expect(ensureBucketAndLifecycleRule(mockS3Client, 'test-bucket', 30))
      .rejects.toThrow('Bucket creation failed')

    expect(mockS3Client.send).toHaveBeenCalledTimes(2)
  })
})
