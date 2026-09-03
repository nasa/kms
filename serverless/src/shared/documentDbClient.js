import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { MongoClient } from 'mongodb'

import { getSecretsManagerClient } from '@/shared/awsClients'

const DEFAULT_DATABASE_NAME = 'kms'
const DEFAULT_AUDIT_COLLECTION_NAME = 'metadataCorrectionAudits'
const DEFAULT_MAX_POOL_SIZE = 5

let mongoClientPromise

/**
 * Parses a positive integer setting while retaining a safe default for missing/invalid values.
 *
 * @example
 * parsePositiveInteger('9', 5) // 9
 * parsePositiveInteger('0', 5) // 5
 *
 * @param {unknown} value Configured value.
 * @param {number} fallback Value used when the input is not a positive integer.
 * @returns {number} Parsed value or fallback.
 */
const parsePositiveInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10)

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback
}

/**
 * Loads and validates the DocumentDB username/password JSON managed by Secrets Manager.
 *
 * @returns {Promise<{username: string, password: string}>} DocumentDB credentials.
 */
const getDocumentDbSecret = async () => {
  const secretArn = process.env.DOCUMENTDB_SECRET_ARN

  if (!secretArn) {
    throw new Error('Missing DOCUMENTDB_SECRET_ARN')
  }

  const response = await getSecretsManagerClient().send(new GetSecretValueCommand({
    SecretId: secretArn
  }))

  if (!response.SecretString) {
    throw new Error('DocumentDB secret does not contain SecretString credentials')
  }

  const credentials = JSON.parse(response.SecretString)

  if (!credentials.username || !credentials.password) {
    throw new Error('DocumentDB secret is missing username or password')
  }

  return credentials
}

/**
 * Builds MongoClient connection inputs for local MongoDB or deployed DocumentDB.
 *
 * @example
 * // DOCUMENTDB_URI=mongodb://localhost:27018
 * await buildDocumentDbConnection()
 * // { uri: 'mongodb://localhost:27018', options: { maxPoolSize: 5, ... } }
 *
 * @example
 * // With DOCUMENTDB_HOST, DOCUMENTDB_SECRET_ARN, and DOCUMENTDB_TLS_CA_FILE configured:
 * await buildDocumentDbConnection()
 * // { uri: 'mongodb://<encoded credentials>@<host>:27017/?tls=true&...', options: { tlsCAFile, ... } }
 *
 * @returns {Promise<{uri: string, options: import('mongodb').MongoClientOptions}>}
 * MongoClient constructor arguments.
 */
const buildDocumentDbConnection = async () => {
  const localUri = process.env.DOCUMENTDB_URI
  const options = {
    maxPoolSize: parsePositiveInteger(
      process.env.DOCUMENTDB_MAX_POOL_SIZE,
      DEFAULT_MAX_POOL_SIZE
    ),
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000
  }

  if (localUri) {
    return {
      uri: localUri,
      options
    }
  }

  const host = process.env.DOCUMENTDB_HOST
  const port = process.env.DOCUMENTDB_PORT || '27017'
  const tlsCAFile = process.env.DOCUMENTDB_TLS_CA_FILE

  if (!host) {
    throw new Error('Missing DOCUMENTDB_HOST')
  }

  if (!tlsCAFile) {
    throw new Error('Missing DOCUMENTDB_TLS_CA_FILE')
  }

  const { username, password } = await getDocumentDbSecret()
  const encodedUsername = encodeURIComponent(username)
  const encodedPassword = encodeURIComponent(password)

  return {
    uri: `mongodb://${encodedUsername}:${encodedPassword}@${host}:${port}/?tls=true&replicaSet=rs0&readPreference=primary&retryWrites=false&authSource=admin`,
    options: {
      ...options,
      tlsCAFile
    }
  }
}

/**
 * Returns the shared MongoDB client used for DocumentDB access.
 *
 * The connection promise is reused across warm Lambda invocations to keep the number of
 * DocumentDB connections bounded.
 *
 * @returns {Promise<MongoClient>} Connected MongoDB client.
 *
 * @example
 * const client = await getDocumentDbClient()
 * const database = client.db('kms')
 */
export const getDocumentDbClient = async () => {
  if (!mongoClientPromise) {
    mongoClientPromise = buildDocumentDbConnection()
      .then(({ uri, options }) => new MongoClient(uri, options).connect())
      .catch((error) => {
        mongoClientPromise = undefined
        throw error
      })
  }

  return mongoClientPromise
}

/**
 * Closes the shared client, primarily for local scripts and test teardown.
 *
 * Lambda handlers intentionally leave the client open so warm invocations can reuse it.
 *
 * @returns {Promise<void>} Resolves after the client has closed.
 */
export const closeDocumentDbClient = async () => {
  const clientPromise = mongoClientPromise
  mongoClientPromise = undefined

  if (!clientPromise) return

  const client = await clientPromise
  await client.close()
}

/**
 * Returns the metadata-correction audit collection.
 *
 * @returns {Promise<import('mongodb').Collection>} Audit collection.
 *
 * @example
 * const audits = await getMetadataCorrectionAuditCollection()
 * await audits.findOne({ runId: 'run-1' })
 */
export const getMetadataCorrectionAuditCollection = async () => {
  const client = await getDocumentDbClient()
  const databaseName = process.env.DOCUMENTDB_DATABASE_NAME || DEFAULT_DATABASE_NAME
  const collectionName = process.env.DOCUMENTDB_AUDIT_COLLECTION_NAME
    || DEFAULT_AUDIT_COLLECTION_NAME

  return client.db(databaseName).collection(collectionName)
}

export default getDocumentDbClient
