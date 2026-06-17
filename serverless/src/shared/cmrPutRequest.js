import { logger } from './logger'

/**
 * Resolves the configured CMR base endpoint for outbound requests.
 *
 * @returns {{endpoint: string}} Normalized endpoint configuration.
 * @throws {Error} If `CMR_BASE_URL` is not configured.
 */
const getEndpointConfig = () => {
  const baseUrl = process.env.CMR_BASE_URL

  if (!baseUrl) {
    throw new Error('CMR_BASE_URL environment variable is not set')
  }

  return {
    endpoint: `${baseUrl}`
  }
}

/**
 * Extracts the serializable parts of an error object for structured logging.
 *
 * @param {Error|Object|undefined|null} error Error-like object to inspect.
 * @returns {Object|undefined} Serializable error details, or `undefined` when absent.
 */
const extractErrorDetails = (error) => {
  if (!error) {
    return undefined
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    errno: error.errno,
    syscall: error.syscall,
    address: error.address,
    port: error.port
  }
}

/**
 * Makes a PUT request to the CMR (Common Metadata Repository) API.
 *
 * @param {Object} options - The options for the PUT request.
 * @param {string} options.path - The API endpoint path.
 * @param {string|Object} [options.body] - The request body (optional).
 * @param {string} [options.contentType='application/json'] - The Content-Type header.
 * @param {string} [options.accept='application/json'] - The Accept header.
 * @param {Object} [options.headers={}] - Additional request headers.
 * @returns {Promise<Response>} A promise that resolves with the fetch Response object.
 */
export const cmrPutRequest = async ({
  path,
  body,
  contentType = 'application/json',
  accept = 'application/json',
  headers = {}
}) => {
  const { endpoint } = getEndpointConfig()
  const fullUrl = `${endpoint}${path}`

  const fetchOptions = {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Accept: accept,
      ...headers
    }
  }

  if (body && body !== '') {
    fetchOptions.body = body
  }

  logger.debug('URL:', fullUrl, 'with options:', fetchOptions)

  logger.info('[cmr-put] Sending CMR request', {
    method: 'PUT',
    endpoint,
    path,
    fullUrl,
    bodyLength: typeof body === 'string' ? body.length : undefined
  })

  try {
    return await fetch(fullUrl, fetchOptions)
  } catch (error) {
    const requestContext = {
      method: 'PUT',
      endpoint,
      path,
      fullUrl,
      bodyLength: typeof body === 'string' ? body.length : undefined
    }

    logger.error('[cmr-put] CMR write failed', {
      ...requestContext,
      error: extractErrorDetails(error),
      cause: extractErrorDetails(error?.cause)
    })

    if (error && typeof error === 'object') {
      error.cmrRequest = requestContext
      error.cmrCause = extractErrorDetails(error?.cause)
    }

    throw error
  }
}

export default cmrPutRequest
