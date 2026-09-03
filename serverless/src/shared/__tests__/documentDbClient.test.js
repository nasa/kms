import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

const {
  collection,
  close,
  connect,
  db,
  mongoClient,
  mongoClientConstructor,
  secretsManagerSend
} = vi.hoisted(() => {
  const collectionMock = { findOne: vi.fn() }
  const dbMock = vi.fn(() => ({
    collection: vi.fn(() => collectionMock)
  }))
  const closeMock = vi.fn()
  const client = {
    close: closeMock,
    db: dbMock
  }

  return {
    collection: collectionMock,
    close: closeMock,
    connect: vi.fn().mockResolvedValue(client),
    db: dbMock,
    mongoClient: client,
    mongoClientConstructor: vi.fn(),
    secretsManagerSend: vi.fn()
  }
})

vi.mock('mongodb', () => ({
  MongoClient: mongoClientConstructor.mockImplementation(function mockMongoClient(uri, options) {
    this.uri = uri
    this.options = options
    this.connect = connect
  })
}))

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  GetSecretValueCommand: vi.fn(function mockGetSecretValueCommand(input) {
    this.input = input
  })
}))

vi.mock('@/shared/awsClients', () => ({
  getSecretsManagerClient: vi.fn(() => ({ send: secretsManagerSend }))
}))

const DOCUMENTDB_ENVIRONMENT_VARIABLES = [
  'DOCUMENTDB_AUDIT_COLLECTION_NAME',
  'DOCUMENTDB_DATABASE_NAME',
  'DOCUMENTDB_HOST',
  'DOCUMENTDB_MAX_POOL_SIZE',
  'DOCUMENTDB_PORT',
  'DOCUMENTDB_SECRET_ARN',
  'DOCUMENTDB_TLS_CA_FILE',
  'DOCUMENTDB_URI'
]

describe('documentDbClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    connect.mockResolvedValue(mongoClient)
    DOCUMENTDB_ENVIRONMENT_VARIABLES.forEach((name) => delete process.env[name])
  })

  afterEach(() => {
    DOCUMENTDB_ENVIRONMENT_VARIABLES.forEach((name) => delete process.env[name])
  })

  test('reuses a local MongoDB connection and returns the configured collection', async () => {
    process.env.DOCUMENTDB_URI = 'mongodb://localhost:27018/?directConnection=true'
    process.env.DOCUMENTDB_DATABASE_NAME = 'test-kms'
    process.env.DOCUMENTDB_AUDIT_COLLECTION_NAME = 'audits'
    process.env.DOCUMENTDB_MAX_POOL_SIZE = '9'
    const {
      getDocumentDbClient,
      getMetadataCorrectionAuditCollection
    } = await import('../documentDbClient')

    await expect(getDocumentDbClient()).resolves.toBe(mongoClient)
    await expect(getDocumentDbClient()).resolves.toBe(mongoClient)
    await expect(getMetadataCorrectionAuditCollection()).resolves.toBe(collection)

    expect(mongoClientConstructor).toHaveBeenCalledOnce()
    expect(mongoClientConstructor).toHaveBeenCalledWith(
      'mongodb://localhost:27018/?directConnection=true',
      expect.objectContaining({
        maxPoolSize: 9,
        minPoolSize: 0
      })
    )

    expect(connect).toHaveBeenCalledOnce()
    expect(db).toHaveBeenCalledWith('test-kms')
  })

  test('closes and resets the shared connection', async () => {
    process.env.DOCUMENTDB_URI = 'mongodb://localhost:27018'
    const {
      closeDocumentDbClient,
      getDocumentDbClient
    } = await import('../documentDbClient')

    await closeDocumentDbClient()
    await getDocumentDbClient()
    await closeDocumentDbClient()
    await getDocumentDbClient()

    expect(close).toHaveBeenCalledOnce()
    expect(mongoClientConstructor).toHaveBeenCalledTimes(2)
  })

  test('builds the deployed TLS connection from Secrets Manager credentials', async () => {
    process.env.DOCUMENTDB_HOST = 'audit.cluster.docdb.amazonaws.com'
    process.env.DOCUMENTDB_PORT = '27017'
    process.env.DOCUMENTDB_SECRET_ARN = 'arn:aws:secretsmanager:secret:audit'
    process.env.DOCUMENTDB_TLS_CA_FILE = '/var/task/us-east-1-bundle.pem'
    secretsManagerSend.mockResolvedValue({
      SecretString: JSON.stringify({
        username: 'user@example.com',
        password: 'password/with spaces'
      })
    })

    const { getDocumentDbClient } = await import('../documentDbClient')

    await getDocumentDbClient()

    expect(secretsManagerSend).toHaveBeenCalledWith(expect.objectContaining({
      input: { SecretId: 'arn:aws:secretsmanager:secret:audit' }
    }))

    expect(mongoClientConstructor).toHaveBeenCalledWith(
      'mongodb://user%40example.com:password%2Fwith%20spaces@audit.cluster.docdb.amazonaws.com:27017/?tls=true&replicaSet=rs0&readPreference=primary&retryWrites=false&authSource=admin',
      expect.objectContaining({
        maxPoolSize: 5,
        tlsCAFile: '/var/task/us-east-1-bundle.pem'
      })
    )
  })

  test('validates deployed connection configuration and credentials', async () => {
    let documentDbClient = await import('../documentDbClient')
    await expect(documentDbClient.getDocumentDbClient()).rejects.toThrow(
      'Missing DOCUMENTDB_HOST'
    )

    vi.resetModules()
    process.env.DOCUMENTDB_HOST = 'audit.cluster.docdb.amazonaws.com'
    documentDbClient = await import('../documentDbClient')
    await expect(documentDbClient.getDocumentDbClient()).rejects.toThrow(
      'Missing DOCUMENTDB_TLS_CA_FILE'
    )

    vi.resetModules()
    process.env.DOCUMENTDB_TLS_CA_FILE = '/tmp/ca.pem'
    documentDbClient = await import('../documentDbClient')
    await expect(documentDbClient.getDocumentDbClient()).rejects.toThrow(
      'Missing DOCUMENTDB_SECRET_ARN'
    )

    vi.resetModules()
    process.env.DOCUMENTDB_SECRET_ARN = 'arn:aws:secretsmanager:secret:audit'
    secretsManagerSend.mockResolvedValue({})
    documentDbClient = await import('../documentDbClient')
    await expect(documentDbClient.getDocumentDbClient()).rejects.toThrow(
      'DocumentDB secret does not contain SecretString credentials'
    )

    vi.resetModules()
    secretsManagerSend.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'kms_audit' })
    })

    documentDbClient = await import('../documentDbClient')
    await expect(documentDbClient.getDocumentDbClient()).rejects.toThrow(
      'DocumentDB secret is missing username or password'
    )
  })

  test('retries connection creation after a failed connection', async () => {
    process.env.DOCUMENTDB_URI = 'mongodb://localhost:27018'
    connect
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValueOnce(mongoClient)

    const { getDocumentDbClient } = await import('../documentDbClient')

    await expect(getDocumentDbClient()).rejects.toThrow('connection failed')
    await expect(getDocumentDbClient()).resolves.toBe(mongoClient)
    expect(mongoClientConstructor).toHaveBeenCalledTimes(2)
  })
})
