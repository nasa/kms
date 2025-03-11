export const cmrRequest = async ({
  path = '',
  method,
  body,
  contentType = 'application/xml',
  accept = 'application/xml'
}) => {
  const getCmrEndpoint = () => {
    // Const baseUrl = process.env.CMR_SERVICE_URL
    const baseUrl = 'https://cmr.earthdata.nasa.gov'

    return `${baseUrl}`
  }

  const endpoint = getCmrEndpoint()

  console.log('endpoint=', endpoint)
  console.log('path=', path)
  console.log('method=', method)
  console.log('body=', body)

  return fetch(`${endpoint}${path}`, {
    method,
    headers: {
      'Content-Type': contentType,
      Accept: accept
    },
    body
  })
}
