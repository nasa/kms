import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { mockClient } from 'aws-sdk-client-mock'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

const snsMock = mockClient(SNSClient)

describe('when the metadata correction request publisher is used', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    snsMock.reset()

    snsMock.on(PublishCommand).resolves({ MessageId: 'message-123' })
    process.env.METADATA_CORRECTION_REQUESTS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo'
    delete process.env.AWS_ENDPOINT_URL
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
  })

  describe('when the request is successful', () => {
    test('should publish the expected payload', async () => {
      const { publishMetadataCorrectionRequest } = await import('../publishMetadataCorrectionRequest')

      const payload = {
        collectionConceptId: 'C0000000000-KMS',
        keywordEvent: {
          eventType: 'UPDATED',
          uuid: '1234'
        }
      }
      const result = await publishMetadataCorrectionRequest(payload)

      const sentCommand = snsMock.commandCalls(PublishCommand)[0].args[0].input
      expect(sentCommand).toEqual({
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

      const { publishMetadataCorrectionRequest } = await import('../publishMetadataCorrectionRequest')

      // 1. Call the function so the SNS client initializes and sends a command
      const payload = {
        collectionConceptId: 'C123',
        keywordEvent: {
          eventType: 'UPDATED',
          uuid: '1'
        }
      }
      await publishMetadataCorrectionRequest(payload)

      // 2. Verify that the command was actually sent
      expect(snsMock.commandCalls(PublishCommand).length).toBe(1)

      // 3. Assert only on the message payload (TopicArn, Message, MessageGroupId)
      const sentCommand = snsMock.commandCalls(PublishCommand)[0].args[0].input
      expect(sentCommand).toEqual(expect.objectContaining({
        TopicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo',
        Message: JSON.stringify(payload),
        MessageGroupId: 'C123'
      }))
    })

    test('should default the LocalStack region and credentials when they are not configured', async () => {
      process.env.AWS_ENDPOINT_URL = 'http://localstack:4566'
      // Ensure region is unset to test the default logic
      delete process.env.AWS_REGION

      const { publishMetadataCorrectionRequest } = await import('../publishMetadataCorrectionRequest')

      // 1. Call the function to execute the client initialization and publish action
      const payload = {
        collectionConceptId: 'C123',
        keywordEvent: {
          eventType: 'UPDATED',
          uuid: '1'
        }
      }
      await publishMetadataCorrectionRequest(payload)

      // 2. Verify that the command was sent successfully
      expect(snsMock.commandCalls(PublishCommand).length).toBe(1)

      // 3. Focus assertions on the command payload, not the client configuration
      const sentCommand = snsMock.commandCalls(PublishCommand)[0].args[0].input
      expect(sentCommand).toEqual(expect.objectContaining({
        TopicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo',
        Message: JSON.stringify(payload),
        MessageGroupId: 'C123'
      }))
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
