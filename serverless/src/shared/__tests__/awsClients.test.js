import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

// Mock the AWS SDK clients before any imports
const { s3ClientMock, eventBridgeClientMock, snsClientMock } = vi.hoisted(() => ({
  s3ClientMock: vi.fn(),
  eventBridgeClientMock: vi.fn(),
  snsClientMock: vi.fn()
}))

vi.mock('@aws-sdk/client-s3', () => ({ S3Client: s3ClientMock }))
vi.mock('@aws-sdk/client-eventbridge', () => ({ EventBridgeClient: eventBridgeClientMock }))
vi.mock('@aws-sdk/client-sns', () => ({ SNSClient: snsClientMock }))

describe('awsClients', () => {
  beforeEach(() => {
    // Reset modules to clear singleton instances between tests
    vi.resetModules()
    vi.clearAllMocks()
    // Ensure a clean environment for each test
    delete process.env.AWS_ENDPOINT_URL
  })

  afterEach(() => {
    delete process.env.AWS_ENDPOINT_URL
  })

  describe('when AWS_ENDPOINT_URL is not set (standard AWS)', () => {
    test('getS3Client should create a client with default config', async () => {
      const { getS3Client } = await import('../awsClients')

      getS3Client()

      expect(s3ClientMock).toHaveBeenCalledWith({})
    })

    test('getEventBridgeClient should create a client with default config', async () => {
      const { getEventBridgeClient } = await import('../awsClients')

      getEventBridgeClient()

      expect(eventBridgeClientMock).toHaveBeenCalledWith({})
    })

    test('getSnsClient should create a client with default config', async () => {
      const { getSnsClient } = await import('../awsClients')

      getSnsClient()

      expect(snsClientMock).toHaveBeenCalledWith({})
    })
  })

  describe('when AWS_ENDPOINT_URL is set (LocalStack)', () => {
    const localstackEndpoint = 'http://localhost:4566'
    const expectedConfig = {
      endpoint: localstackEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      },
      forcePathStyle: true
    }

    beforeEach(() => {
      process.env.AWS_ENDPOINT_URL = localstackEndpoint
    })

    test('getS3Client should create a client with LocalStack config', async () => {
      const { getS3Client } = await import('../awsClients')

      getS3Client()

      expect(s3ClientMock).toHaveBeenCalledWith(expectedConfig)
    })

    test('getEventBridgeClient should create a client with LocalStack config', async () => {
      const { getEventBridgeClient } = await import('../awsClients')

      getEventBridgeClient()

      expect(eventBridgeClientMock).toHaveBeenCalledWith(expectedConfig)
    })

    test('getSnsClient should create a client with LocalStack config', async () => {
      const { getSnsClient } = await import('../awsClients')

      getSnsClient()

      expect(snsClientMock).toHaveBeenCalledWith(expectedConfig)
    })
  })

  describe('singleton behavior', () => {
    test('getS3Client should only create one instance', async () => {
      const { getS3Client } = await import('../awsClients')

      const client1 = getS3Client()
      const client2 = getS3Client()

      expect(s3ClientMock).toHaveBeenCalledTimes(1)
      expect(client1).toBe(client2)
    })

    test('getEventBridgeClient should only create one instance', async () => {
      const { getEventBridgeClient } = await import('../awsClients')

      const client1 = getEventBridgeClient()
      const client2 = getEventBridgeClient()

      expect(eventBridgeClientMock).toHaveBeenCalledTimes(1)
      expect(client1).toBe(client2)
    })

    test('getSnsClient should only create one instance', async () => {
      const { getSnsClient } = await import('../awsClients')

      const client1 = getSnsClient()
      const client2 = getSnsClient()

      expect(snsClientMock).toHaveBeenCalledTimes(1)
      expect(client1).toBe(client2)
    })
  })
})
