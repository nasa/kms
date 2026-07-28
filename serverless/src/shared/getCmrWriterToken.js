import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

import { logger } from './logger'

/**
 * Reads the configured writer token from runtime environment.
 *
 * @returns {string} Trimmed authorization value or an empty string when unset.
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
 * Validates that configured CMR auth values are already full bearer authorization
 * header values so callers can forward them unchanged.
 *
 * @param {string} token Raw configured token value.
 * @param {string} source Source label used in warning logs.
 * @returns {string} Trimmed authorization value, or an empty string when absent/invalid.
 */
const resolveAuthorizationHeaderValue = (token, source) => {
  const normalizedToken = String(token || '').trim()

  if (!normalizedToken) {
    return ''
  }

  if (!/^bearer\s+.+$/i.test(normalizedToken)) {
    logger.warn('[cmr-token] Ignoring configured token that is missing a Bearer prefix', {
      source
    })

    return ''
  }

  return normalizedToken
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
 * Returns the CMR system token sourced from the configured SSM parameter.
 *
 * @returns {Promise<string|undefined>} Resolved CMR system authorization value, or `undefined`
 * when unavailable.
 */
export const getCmrSystemToken = async () => {
  const parameterName = getSystemTokenParameterName()
  const systemToken = resolveAuthorizationHeaderValue(
    await readSystemTokenFromSsm(parameterName),
    'ssm'
  )

  return systemToken || undefined
}

/**
 * Returns the CMR token used for ingest/writeback requests.
 *
 * Resolution order:
 * 1. SSM SecureString system token, when configured
 * 2. `CMR_WRITER_TOKEN` from environment
 *
 * @returns {Promise<string|undefined>} Resolved CMR authorization header value, or `undefined`
 * when no usable token is available.
 */
export const getCmrWriterToken = async () => {
  const ssmToken = await getCmrSystemToken()

  if (ssmToken) {
    return ssmToken
  }

  const configuredToken = resolveAuthorizationHeaderValue(getConfiguredWriterToken(), 'env')

  if (configuredToken) {
    return configuredToken
  }

  return undefined
}

export default getCmrWriterToken
