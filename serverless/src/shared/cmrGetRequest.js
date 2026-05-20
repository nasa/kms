import { logger } from './logger'

const getEndpointConfig = () => {
  const baseUrl = process.env.CMR_BASE_URL

  if (!baseUrl) {
    throw new Error('CMR_BASE_URL environment variable is not set')
  }

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
 * Make a GET request to the NASA Common Metadata Repository (CMR) API.
 *
 * This function constructs the full URL for the CMR API request by combining
 * the base URL from the environment variable and the provided path. It then
 * sends a GET request to this URL.
 *
 * @param {Object} options - The options for the request.
 * @param {string} options.path - The specific path for the CMR API endpoint.
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object.
 *
 * @example
 * // Example usage:
 * const response = await cmrGetRequest({
 *   path: '/search/collections.json?keyword=MODIS'
 * });
 * const data = await response.json();
 * console.log(data);
 */
export const cmrGetRequest = async ({
  path,
  accept,
  headers = {}
}) => {
  const { endpoint } = getEndpointConfig()
  const fullUrl = `${endpoint}${path}`

  const requestHeaders = {
    ...(accept ? { Accept: accept } : {}),
    ...headers
  }

  const fetchOptions = {
    method: 'GET'
  }

  if (Object.keys(requestHeaders).length > 0) {
    fetchOptions.headers = requestHeaders
  }

  logger.debug('URL:', fullUrl, 'with options:', fetchOptions)

  logger.info('[cmr-get] Sending CMR request', {
    method: 'GET',
    endpoint,
    path,
    fullUrl
  })

  try {
    return await fetch(fullUrl, fetchOptions)
  } catch (error) {
    const requestContext = {
      method: 'GET',
      endpoint,
      path,
      fullUrl
    }

    logger.error('[cmr-get] CMR fetch failed', {
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
