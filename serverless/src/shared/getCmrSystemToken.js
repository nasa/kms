import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'

import { logger } from './logger'

let cachedSystemToken
let secretsManagerClient

const getSecretsManagerClient = () => {
  if (!secretsManagerClient) {
    secretsManagerClient = new SecretsManagerClient({})
  }

  return secretsManagerClient
}

const extractTokenFromSecret = (secretString = '') => {
  const normalizedSecretString = String(secretString).trim()

  if (!normalizedSecretString) {
    throw new Error('CMR system token secret is empty')
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

  throw new Error('CMR system token secret JSON must include a non-empty "token" field')
}

/**
 * Returns the bearer token used for CMR ingest/writeback requests.
 *
 * The deployed path expects a Secrets Manager secret name in
 * `CMR_SYSTEM_TOKEN_SECRET_NAME`. For local development and tests, `CMR_SYSTEM_TOKEN`
 * can be supplied directly.
 *
 * Supported secret formats:
 * - raw token string
 * - JSON object like `{ "token": "..." }`
 *
 * @returns {Promise<string>} CMR bearer token.
 */
export const getCmrSystemToken = async () => {
  if (cachedSystemToken) {
    return cachedSystemToken
  }

  const configuredToken = String(process.env.CMR_SYSTEM_TOKEN || '').trim()

  if (configuredToken) {
    cachedSystemToken = configuredToken

    return cachedSystemToken
  }

  const secretId = String(process.env.CMR_SYSTEM_TOKEN_SECRET_NAME || '').trim()

  if (!secretId) {
    throw new Error(
      'Missing CMR system token configuration: set CMR_SYSTEM_TOKEN_SECRET_NAME '
      + '(or CMR_SYSTEM_TOKEN for local development)'
    )
  }

  logger.info('[cmr-writeback] Fetching CMR system token from Secrets Manager', {
    secretId
  })

  const response = await getSecretsManagerClient().send(new GetSecretValueCommand({
    SecretId: secretId
  }))
  const secretString = response?.SecretString

  if (!secretString) {
    throw new Error(`CMR system token secret ${secretId} did not include SecretString`)
  }

  cachedSystemToken = extractTokenFromSecret(secretString)

  return cachedSystemToken
}

export default getCmrSystemToken
