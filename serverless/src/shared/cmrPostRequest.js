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
  accept = 'application/json'
}) => {
  const getCmrEndpoint = () => {
    const baseUrl = process.env.CMR_BASE_URL

    return `${baseUrl}`
  }

  const endpoint = getCmrEndpoint()

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Accept: accept
    }
  }

  // Only add the body to fetchOptions if it's not empty or null
  if (body && body !== '') {
    fetchOptions.body = body
  }

  return fetch(`${endpoint}${path}`, fetchOptions)
}
