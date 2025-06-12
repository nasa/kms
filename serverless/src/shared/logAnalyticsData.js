import { downcaseKeys } from '@/shared/downcaseKeys'
import { removeEmpty } from '@/shared/removeEmpty'

export const logAnalyticsData = ({
  event = {},
  context = {},
  search = null
}) => {
  const {
    queryStringParameters,
    pathParameters,
    headers: rawHeaders,
    requestContext
  } = event

  try {
    const headers = downcaseKeys(rawHeaders || {})

    const { conceptId, shortName, altLabel } = pathParameters || {}
    const { scheme, format, version } = queryStringParameters || {}
    const { domainName, path, httpMethod } = requestContext || {}

    const clientIp = headers['x-forwarded-for']
    const clientId = headers['client-id']
    const protocol = headers['x-forwarded-proto'] || 'https'

    if (!clientIp || !domainName || !path || !protocol || !httpMethod) {
      return
    }

    // Ensure queryStringParameters is an object before using Object.keys
    const queryString = queryStringParameters && typeof queryStringParameters === 'object' && Object.keys(queryStringParameters).length > 0
      ? `?${new URLSearchParams(queryStringParameters).toString()}`
      : ''

    const fullUrl = `${protocol}://${domainName}${path}${queryString}`
    const { functionName = '' } = context
    const userAgent = headers['user-agent']

    let logObject = {
      analytics: {
        clientIp,
        clientId,
        url: fullUrl,
        resource: functionName,
        action: httpMethod,
        format,
        version,
        scheme,
        concept: conceptId ?? shortName ?? altLabel,
        search,
        userAgent
      }
    }

    logObject = removeEmpty(logObject)

    console.log(JSON.stringify(logObject))
  } catch (error) {
    console.error('Error in logAnalyticsData:', error)
  }
}
