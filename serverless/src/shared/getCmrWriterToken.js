import { createHash } from 'crypto'

import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

import { logger } from './logger'

/**
 * Reads the configured writer token from runtime environment.
 *
 * @returns {string} Trimmed writer token or an empty string when unset.
 */
const getConfiguredWriterToken = () => String(process.env.CMR_WRITER_TOKEN || '').trim()

/**
 * Reads the optional SSM parameter name for the CMR system token.
 *
 * @returns {string} Trimmed parameter name or an empty string when unset.
 */
const getSystemTokenParameterName = () => (
  String(process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME || '').trim()
)

/**
 * Creates the SSM client used for reading the optional system token parameter.
 *
 * @returns {SSMClient} Configured SSM client.
 */
const createSsmClient = () => {
  const endpoint = String(process.env.AWS_ENDPOINT_URL || '').trim()
  const region = String(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '').trim()

  return new SSMClient({
    ...(endpoint ? { endpoint } : {}),
    ...(region ? { region } : {})
  })
}

/**
 * Decodes the JWT expiration timestamp when the token is JWT-shaped.
 *
 * @param {string} token Raw token value.
 * @returns {number|null} Expiration timestamp in milliseconds, or `null` when unavailable.
 */
const decodeJwtExpirationMs = (token) => {
  const payload = String(token).split('.')[1]

  if (!payload) {
    return null
  }

  try {
    const normalizedPayload = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '='
    )
    const claims = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8'))
    const expSeconds = Number(claims?.exp)

    if (!Number.isFinite(expSeconds) || expSeconds <= 0) {
      return null
    }

    return expSeconds * 1000
  } catch {
    return null
  }
}

/**
 * True when the token carries a JWT expiration that is already in the past.
 *
 * @param {string} token Raw token value.
 * @returns {boolean} `true` when the token is JWT-shaped and expired.
 */
const isExpiredToken = (token) => {
  const expirationMs = decodeJwtExpirationMs(token)

  return expirationMs !== null && expirationMs <= Date.now()
}

/**
 * Removes an optional bearer prefix from configured token values so either
 * `token` or `Bearer token` works for env and SSM storage.
 *
 * @param {string} token Raw configured token.
 * @returns {string} Token value without a bearer prefix.
 */
const stripBearerPrefix = (token) => {
  const normalizedToken = String(token || '').trim()
  const bearerMatch = normalizedToken.match(/^bearer\s+(.*)$/i)

  return bearerMatch ? bearerMatch[1].trim() : normalizedToken
}

/**
 * Returns a short, non-reversible fingerprint for log-only token correlation.
 *
 * @param {string} token Normalized token value.
 * @returns {string} Short SHA-256 fingerprint, or an empty string when token is absent.
 */
const createTokenFingerprint = (token) => {
  const normalizedToken = String(token || '').trim()

  if (!normalizedToken) {
    return ''
  }

  return createHash('sha256')
    .update(normalizedToken)
    .digest('hex')
    .slice(0, 12)
}

/**
 * Reads the optional system token from SSM SecureString.
 *
 * @param {string} parameterName SSM parameter name.
 * @returns {Promise<string>} Trimmed SSM token value or an empty string when unavailable.
 */
const readSystemTokenFromSsm = async (parameterName) => {
  if (!parameterName) {
    return ''
  }

  try {
    const response = await createSsmClient().send(new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true
    }))

    return String(response.Parameter?.Value || '').trim()
  } catch (error) {
    logger.warn('[cmr-writeback] Failed to read system token from SSM; falling back to CMR_WRITER_TOKEN', {
      errorMessage: error.message
    })

    return ''
  }
}

/**
 * Normalizes a token candidate, dropping expired JWTs but preserving opaque/non-JWT tokens.
 *
 * @param {string} token Raw token candidate.
 * @returns {string} Usable trimmed token, or an empty string when absent/expired.
 */
const resolveUsableToken = (token) => {
  const normalizedToken = stripBearerPrefix(token)

  if (!normalizedToken) {
    return ''
  }

  return isExpiredToken(normalizedToken) ? '' : normalizedToken
}

/**
 * Returns the CMR token used for ingest/writeback requests.
 *
 * Resolution order:
 * 1. SSM SecureString system token, when configured and still valid
 * 2. `CMR_WRITER_TOKEN` from environment
 *
 * @param {Object} [options={}] Optional resolver controls.
 * @param {boolean} [options.throwOnMissing=true] Whether to throw instead of returning an empty string
 * when no usable token is available.
 * @returns {Promise<string>} Resolved CMR bearer token.
 * @throws {Error} If no usable token is available and `throwOnMissing` is `true`.
 */
export const getCmrWriterToken = async ({
  throwOnMissing = true
} = {}) => {
  const parameterName = getSystemTokenParameterName()
  const ssmToken = resolveUsableToken(await readSystemTokenFromSsm(parameterName))

  if (ssmToken) {
    return ssmToken
  }

  const configuredToken = resolveUsableToken(getConfiguredWriterToken())

  if (configuredToken) {
    return configuredToken
  }

  if (!throwOnMissing) {
    return ''
  }

  throw new Error(
    'Missing usable CMR writer token configuration: set CMR_WRITER_TOKEN or configure CMR_SYSTEM_TOKEN_PARAMETER_NAME'
  )
}

/**
 * Returns non-sensitive characteristics about the resolved CMR token source and shape.
 *
 * @returns {Promise<Object>} Token debug characteristics safe for temporary logging.
 */
export const getCmrWriterTokenDebugInfo = async () => {
  const parameterName = getSystemTokenParameterName()
  const rawSsmToken = await readSystemTokenFromSsm(parameterName)
  const rawConfiguredToken = getConfiguredWriterToken()
  const rawToken = rawSsmToken || rawConfiguredToken || ''
  const normalizedToken = stripBearerPrefix(rawToken)
  let source = 'none'

  if (rawSsmToken) {
    source = 'ssm'
  } else if (rawConfiguredToken) {
    source = 'env'
  }

  return {
    source,
    hasBearerPrefix: /^bearer\s+/i.test(String(rawToken || '').trim()),
    tokenLength: normalizedToken.length,
    jwtShaped: normalizedToken.split('.').length === 3,
    hasDecodedExp: decodeJwtExpirationMs(normalizedToken) !== null,
    fingerprint: createTokenFingerprint(normalizedToken)
  }
}

export default getCmrWriterToken
