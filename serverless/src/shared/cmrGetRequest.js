import { logger } from './logger'

const DEFAULT_CMR_GET_TIMEOUT_MS = 25_000

const getCmrGetTimeoutMs = () => {
  const timeoutMs = Number(process.env.CMR_GET_TIMEOUT_MS)

  // Reject invalid settings and values that would overflow Node's timer interval.
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    return DEFAULT_CMR_GET_TIMEOUT_MS
  }

  return timeoutMs
}

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
 * CMR_GET_TIMEOUT_MS bounds each request, including response body consumption,
 * and defaults to 25 seconds. Failed requests are not retried here.
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
  const timeoutMs = getCmrGetTimeoutMs()

  const requestHeaders = {
    ...(accept ? { Accept: accept } : {}),
    ...headers
  }

  const fetchOptions = {
    method: 'GET',
    // A longer Lambda timeout does not bound individual GETs: one stalled request could
    // consume the entire invocation. When Lambda times out, AWS stops the invocation
    // before our catch block can record the failure in the audit log. Aborting just
    // the GET while Lambda is still running lets callers catch and audit the error,
    // then continue the batch without retrying. This limits each request, not the workflow.
    // Keep the signal active after fetch resolves: callers still need to read the body.
    signal: AbortSignal.timeout(timeoutMs)
  }

  if (Object.keys(requestHeaders).length > 0) {
    fetchOptions.headers = requestHeaders
  }

  const loggableFetchOptions = {
    method: fetchOptions.method,
    ...(fetchOptions.headers ? { headerNames: Object.keys(fetchOptions.headers) } : {})
  }

  logger.debug('URL:', fullUrl, 'with options:', loggableFetchOptions)

  logger.info('[cmr-get] Sending CMR request', {
    method: 'GET',
    endpoint,
    path,
    fullUrl,
    timeoutMs
  })

  try {
    return await fetch(fullUrl, fetchOptions)
  } catch (error) {
    const requestContext = {
      method: 'GET',
      endpoint,
      path,
      fullUrl,
      timeoutMs
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
