import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'

import { logger } from './logger'

let cachedWriterToken
let secretsManagerClient

/**
 * Lazily creates and reuses the Secrets Manager client used for token lookup.
 *
 * @returns {SecretsManagerClient} Shared Secrets Manager client instance.
 */
const getSecretsManagerClient = () => {
  if (!secretsManagerClient) {
    secretsManagerClient = new SecretsManagerClient({})
  }

  return secretsManagerClient
}

/**
 * Extracts a bearer token from a raw or JSON-formatted secret payload.
 *
 * Supported secret formats:
 * - raw token string
 * - JSON object like `{ "token": "..." }`
 *
 * @param {string} [secretString=''] Secrets Manager `SecretString` payload.
 * @returns {string} Trimmed bearer token.
 * @throws {Error} If the secret is empty or does not contain a usable token.
 */
const extractTokenFromSecret = (secretString) => {
  const normalizedSecretString = String(secretString ?? '').trim()

  if (!normalizedSecretString) {
    throw new Error('CMR writer token secret is empty')
  }

  try {
    const parsedSecret = JSON.parse(normalizedSecretString)
    const token = parsedSecret?.token

    if (typeof token === 'string' && token.trim().length > 0) {
      return token.trim()
    }
  } catch {
    return normalizedSecretString
  }

  throw new Error('CMR writer token secret JSON must include a non-empty "token" field')
}

/**
 * Reads the direct writer-token override from runtime environment variables.
 *
 * @returns {string} Trimmed writer token or an empty string when unset.
 */
const getConfiguredWriterToken = () => String(
  process.env.CMR_WRITER_TOKEN
  || process.env.CMR_WRITE_TOKEN
  || ''
).trim()

/**
 * Reads the configured Secrets Manager secret name from runtime environment variables.
 *
 * @returns {string} Trimmed secret name or an empty string when unset.
 */
const getConfiguredWriterTokenSecretName = () => String(
  process.env.CMR_WRITER_TOKEN_SECRET_NAME
  || process.env.CMR_WRITE_TOKEN_SECRET_NAME
  || ''
).trim()

/**
 * Returns the bearer token used for CMR ingest/writeback requests.
 *
 * The deployed path expects a Secrets Manager secret name in
 * `CMR_WRITER_TOKEN_SECRET_NAME`. For local development and tests, `CMR_WRITER_TOKEN`
 * can be supplied directly.
 *
 * Supported secret formats:
 * - raw token string
 * - JSON object like `{ "token": "..." }`
 *
 * @returns {Promise<string>} CMR bearer token.
 */
export const getCmrWriterToken = async () => {
  if (cachedWriterToken) {
    return cachedWriterToken
  }

  const configuredToken = getConfiguredWriterToken()

  if (configuredToken) {
    cachedWriterToken = configuredToken

    return cachedWriterToken
  }

  const secretId = getConfiguredWriterTokenSecretName()

  if (!secretId) {
    throw new Error(
      'Missing CMR writer token configuration: set CMR_WRITER_TOKEN_SECRET_NAME '
      + '(or CMR_WRITER_TOKEN for local development)'
    )
  }

  logger.info('[cmr-writeback] Fetching CMR writer token from Secrets Manager', {
    secretId
  })

  const response = await getSecretsManagerClient().send(new GetSecretValueCommand({
    SecretId: secretId
  }))
  const secretString = response?.SecretString

  if (secretString === undefined) {
    throw new Error(`CMR writer token secret ${secretId} did not include SecretString`)
  }

  cachedWriterToken = extractTokenFromSecret(secretString)

  return cachedWriterToken
}

export default getCmrWriterToken
