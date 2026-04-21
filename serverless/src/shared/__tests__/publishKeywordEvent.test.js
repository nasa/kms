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

describe('when the keyword event publisher is used', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.KEYWORD_EVENTS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events'
    delete process.env.AWS_ENDPOINT_URL
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
  })

  describe('when the request is successful', () => {
    describe('when the topic ARN is configured', () => {
      test('should publish the expected payload', async () => {
        sendMock.mockResolvedValue({ MessageId: 'message-123' })
        const { publishKeywordEvent } = await import('../publishKeywordEvent')

        const payload = { event_type: 'keyword_updated' }
        const result = await publishKeywordEvent(payload)

        expect(sendMock).toHaveBeenCalledWith({
          TopicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events',
          Message: JSON.stringify(payload)
        })

        expect(result).toMatchObject({
          messageId: 'message-123',
          topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events'
        })
      })
    })

    describe('when a LocalStack endpoint override is configured', () => {
      test('should create the SNS client with the override', async () => {
        process.env.AWS_ENDPOINT_URL = 'http://localstack:4566'
        process.env.AWS_REGION = 'us-east-1'
        sendMock.mockResolvedValue({ MessageId: 'message-123' })

        await import('../publishKeywordEvent')

        expect(snsClientMock).toHaveBeenCalledWith({
          endpoint: 'http://localstack:4566',
          region: 'us-east-1',
          credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test'
          },
          forcePathStyle: true
        })
      })

      test('should default the region and credentials when they are not configured', async () => {
        process.env.AWS_ENDPOINT_URL = 'http://localstack:4566'
        sendMock.mockResolvedValue({ MessageId: 'message-123' })

        await import('../publishKeywordEvent')

        expect(snsClientMock).toHaveBeenCalledWith({
          endpoint: 'http://localstack:4566',
          region: 'us-east-1',
          credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test'
          },
          forcePathStyle: true
        })
      })
    })
  })

  describe('when the request is unsuccessful', () => {
    describe('when the topic ARN is missing', () => {
      test('should throw an error', async () => {
        delete process.env.KEYWORD_EVENTS_TOPIC_ARN
        const { publishKeywordEvent } = await import('../publishKeywordEvent')

        await expect(publishKeywordEvent({ event_type: 'keyword_updated' }))
          .rejects
          .toThrow('Missing KEYWORD_EVENTS_TOPIC_ARN')
      })
    })
  })
})
