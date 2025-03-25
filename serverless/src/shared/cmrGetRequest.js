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
  path
}) => {
  const getCmrEndpoint = () => {
    const baseUrl = process.env.CMR_BASE_URL

    return `${baseUrl}`
  }

  const endpoint = getCmrEndpoint()

  const fetchOptions = {
    method: 'GET'
  }

  return fetch(`${endpoint}${path}`, fetchOptions)
}
