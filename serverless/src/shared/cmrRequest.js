export const cmrRequest = async ({
  path = '',
  method,
  body,
  contentType = 'application/json',
  accept = 'application/json'
}) => {
  const getCmrEndpoint = () => {
    const baseUrl = process.env.CMR_BASE_URL
    // Const baseUrl = 'https://cmr.earthdata.nasa.gov'

    return `${baseUrl}`
  }

  const endpoint = getCmrEndpoint()

  const fetchOptions = {
    method,
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
