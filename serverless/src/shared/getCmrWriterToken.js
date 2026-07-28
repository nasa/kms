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
    logger.warn('[cmr-token] Failed to read system token from SSM', {
      errorMessage: error.message
    })

    return ''
  }
}

/**
 * Normalizes a token candidate for runtime use.
 *
 * @param {string} token Raw token candidate.
 * @returns {string} Usable trimmed token, or an empty string when absent.
 */
const resolveUsableToken = (token) => {
  const normalizedToken = stripBearerPrefix(token)

  if (!normalizedToken) {
    return ''
  }

  return normalizedToken
}

/**
 * Returns the CMR system token sourced from the configured SSM parameter.
 *
 * @returns {Promise<string|undefined>} Resolved CMR system token, or `undefined` when unavailable.
 */
export const getCmrSystemToken = async () => {
  const parameterName = getSystemTokenParameterName()
  const systemToken = resolveUsableToken(await readSystemTokenFromSsm(parameterName))

  if (systemToken) {
    return systemToken
  }

  return undefined
}

/**
 * Returns the CMR token used for ingest/writeback requests.
 *
 * Resolution order:
 * 1. SSM SecureString system token, when configured
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
  const ssmToken = await getCmrSystemToken()

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

export default getCmrWriterToken
