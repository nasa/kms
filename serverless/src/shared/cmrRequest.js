export const cmrRequest = async ({
  path = '',
  method,
  body,
  contentType = 'application/xml',
  accept = 'application/xml'
}) => {
  const getCmrEndpoint = () => {
    const baseUrl = process.env.CMR_SERVICE_URL

    return `${baseUrl}`
  }

  const endpoint = getCmrEndpoint()

  return fetch(`${endpoint}${path}`, {
    method,
    headers: {
      'Content-Type': contentType,
      Accept: accept
    },
    body
  })
}