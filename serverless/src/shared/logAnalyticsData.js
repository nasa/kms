import { buildFullPath } from '@/shared/buildFullPath'
import { removeEmpty } from '@/shared/removeEmpty'

export const logAnalyticsData = ({
  event,
  context,
  action
}) => {
  const { queryStringParameters } = event
  const { pathParameters } = event
  const { conceptId, shortName, altLabel } = pathParameters || {}
  const { scheme, format = 'rdf' } = queryStringParameters || {}
  const version = queryStringParameters?.version || 'published'
  const clientIp = event.headers['X-Forwarded-For']
  const clientId = event.headers['Client-Id']
  const domain = event.requestContext.domainName
  const { path } = event.requestContext
  const protocol = event.headers['X-Forwarded-Proto'] || 'https'

  const queryString = event.queryStringParameters
    ? `?${new URLSearchParams(event.queryStringParameters).toString()}`
    : ''
  const fullUrl = `${protocol}://${domain}${path}${queryString}`
  const { functionName } = context
  const userAgent = event.headers['User-Agent'] || event.headers['user-agent']

  let fullPath
  if (conceptId) {
    fullPath = buildFullPath(conceptId, version)
  }

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
      fullPath,
      concept: conceptId ?? shortName ?? altLabel,
      userAgent
    }
  }

  logObject = removeEmpty(logObject)

  console.log(JSON.stringify(logObject))
}
