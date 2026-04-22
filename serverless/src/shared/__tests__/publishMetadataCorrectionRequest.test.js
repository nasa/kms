import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

const { sendMock, snsClientMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  snsClientMock: vi.fn(() => ({
    send: sendMock
  }))
}))

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: snsClientMock,
  PublishCommand: vi.fn((input) => input)
}))

describe('when the metadata correction request publisher is used', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.METADATA_CORRECTION_REQUESTS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo'
    delete process.env.AWS_ENDPOINT_URL
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
  })

  describe('when the request is successful', () => {
    test('should publish the expected payload', async () => {
      sendMock.mockResolvedValue({ MessageId: 'message-123' })
      const { publishMetadataCorrectionRequest } = await import('../publishMetadataCorrectionRequest')

      const payload = {
        collectionConceptId: 'C0000000000-KMS',
        keywordEvent: {
          eventType: 'UPDATED',
          uuid: '1234'
        }
      }
      const result = await publishMetadataCorrectionRequest(payload)

      expect(sendMock).toHaveBeenCalledWith({
        TopicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo',
        Message: JSON.stringify(payload),
        MessageGroupId: 'C0000000000-KMS'
      })

      expect(result).toMatchObject({
        messageGroupId: 'C0000000000-KMS',
        messageId: 'message-123',
        topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo'
      })
    })

    test('should create the SNS client with the LocalStack override when configured', async () => {
      process.env.AWS_ENDPOINT_URL = 'http://localstack:4566'
      process.env.AWS_REGION = 'us-east-1'
      sendMock.mockResolvedValue({ MessageId: 'message-123' })

      await import('../publishMetadataCorrectionRequest')

      expect(snsClientMock).toHaveBeenCalledWith({
        endpoint: 'http://localstack:4566',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      })
    })

    test('should default the LocalStack region and credentials when they are not configured', async () => {
      process.env.AWS_ENDPOINT_URL = 'http://localstack:4566'
      sendMock.mockResolvedValue({ MessageId: 'message-123' })

      await import('../publishMetadataCorrectionRequest')

      expect(snsClientMock).toHaveBeenCalledWith({
        endpoint: 'http://localstack:4566',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      })
    })
  })

  describe('when the request is unsuccessful', () => {
    test('should throw an error when the topic ARN is missing', async () => {
      delete process.env.METADATA_CORRECTION_REQUESTS_TOPIC_ARN
      const { publishMetadataCorrectionRequest } = await import('../publishMetadataCorrectionRequest')

      await expect(publishMetadataCorrectionRequest({ collectionConceptId: 'C0000000000-KMS' }))
        .rejects
        .toThrow('Missing METADATA_CORRECTION_REQUESTS_TOPIC_ARN')
    })

    test('should throw an error when the collection concept id is missing', async () => {
      const { publishMetadataCorrectionRequest } = await import('../publishMetadataCorrectionRequest')

      await expect(publishMetadataCorrectionRequest({}))
        .rejects
        .toThrow('Missing metadata correction collectionConceptId')
    })
  })
})
