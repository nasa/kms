import { downcaseKeys } from '@/shared/downcaseKeys'
import { removeEmpty } from '@/shared/removeEmpty'

export const logAnalyticsData = ({
  event = {},
  context = {},
  search = null
}) => {
  const {
    queryStringParameters = {},
    pathParameters = {},
    headers: rawHeaders = {},
    requestContext = {}
  } = event

  const headers = downcaseKeys(rawHeaders)

  const { conceptId, shortName, altLabel } = pathParameters
  const { scheme, format } = queryStringParameters
  const version = queryStringParameters?.version
  const clientIp = headers['x-forwarded-for']
  const clientId = headers['client-id']
  const { domainName } = requestContext
  const { path } = requestContext
  const protocol = headers['x-forwarded-proto'] || 'https'
  const action = requestContext.httpMethod

  if (!clientIp || !domainName || !path || !protocol || !action) {
    return
  }

  const queryString = Object.keys(queryStringParameters).length > 0
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
      action,
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
}
