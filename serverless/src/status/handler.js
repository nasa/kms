import { getApplicationConfig } from '../../../sharedUtils/getConfig'

/**
 * Status endpoint
 * @param {Object} event Details about the HTTP request that it received
 */
const status = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()

  return {
    statusCode: 200,
    headers: defaultResponseHeaders,
    body: 'healthy'
  }
}

export default status
