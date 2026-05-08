import { logger } from './logger'

const getEndpointConfig = () => {
  const baseUrl = process.env.CMR_BASE_URL

  return {
    endpoint: `${baseUrl}`
  }
}

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
 * Makes a POST request to the CMR (Common Metadata Repository) API.
 *
 * @param {Object} options - The options for the POST request.
 * @param {string} options.path - The API endpoint path.
 * @param {string|Object} [options.body] - The request body (optional).
 * @param {string} [options.contentType='application/json'] - The Content-Type header (default: 'application/json').
 * @param {string} [options.accept='application/json'] - The Accept header (default: 'application/json').
 * @returns {Promise<Response>} A promise that resolves with the fetch Response object.
 *
 * @example
 * // Example usage:
 * const response = await cmrPostRequest({
 *   path: '/search/collections',
 *   body: JSON.stringify({ keyword: 'climate' }),
 *   contentType: 'application/json',
 *   accept: 'application/json'
 * });
 * const data = await response.json();
 * console.log(data);
 */
export const cmrPostRequest = async ({
  path,
  body,
  contentType = 'application/json',
  accept = 'application/json',
  headers = {}
}) => {
  const { endpoint } = getEndpointConfig()
  const fullUrl = `${endpoint}${path}`

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Accept: accept,
      ...headers
    }
  }

  // Only add the body to fetchOptions if it's not empty or null
  if (body && body !== '') {
    fetchOptions.body = body
  }

  logger.debug('URL:', fullUrl, 'with options:', fetchOptions)

  logger.info('[cmr-post] Sending CMR request', {
    method: 'POST',
    endpoint,
    path,
    fullUrl,
    bodyLength: typeof body === 'string' ? body.length : undefined
  })

  try {
    return await fetch(fullUrl, fetchOptions)
  } catch (error) {
    const requestContext = {
      method: 'POST',
      endpoint,
      path,
      fullUrl,
      bodyLength: typeof body === 'string' ? body.length : undefined
    }

    logger.error('[cmr-post] CMR fetch failed', {
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
