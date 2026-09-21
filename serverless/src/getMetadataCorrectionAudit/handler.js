import { getApplicationConfig } from '@/shared/getConfig'
import {
  getMetadataCorrectionAuditByRunId,
  getMetadataCorrectionAuditLog
} from '@/shared/getMetadataCorrectionAuditLog'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { renderMetadataCorrectionAuditHtml } from '@/shared/renderMetadataCorrectionAuditHtml'

/**
 * Validates the requested audit response representation.
 *
 * @param {unknown} format Requested response format.
 * @returns {'json'|'html'} Normalized response format.
 */
const normalizeResponseFormat = (format) => {
  if (format === undefined || format === null || format === '' || format === 'json') return 'json'
  if (format === 'html') return 'html'

  throw new Error('Invalid metadata correction audit format: expected json or html')
}

/**
 * Preserves the current filters while advancing an HTML audit search to its next page.
 *
 * @param {Object} queryStringParameters Current API query parameters.
 * @param {string|null} paginationToken Opaque next-page token.
 * @returns {string|undefined} Relative next-page URL when another page exists.
 */
const buildNextPageHref = (queryStringParameters, paginationToken) => {
  if (!paginationToken) return undefined

  const parameters = new URLSearchParams()
  Object.entries(queryStringParameters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) parameters.set(key, String(value))
  })

  parameters.set('format', 'html')
  parameters.set('paginationToken', paginationToken)

  return `?${parameters.toString()}`
}

const HTML_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff'
}

const AUDIT_ROUTE_TYPES = {
  DETAIL: 'detail',
  PUBLISHED: 'published',
  SEARCH: 'search'
}

/**
 * Identifies which audit view an API Gateway request targets.
 *
 * @param {Object} event API Gateway event.
 * @returns {{type: string, runId?: string, publishedVersionName?: string}} Resolved route.
 */
const resolveAuditRoute = (event = {}) => {
  const {
    runId,
    versionName
  } = event.pathParameters || {}

  if (runId) {
    return {
      type: AUDIT_ROUTE_TYPES.DETAIL,
      runId
    }
  }

  switch (event.resource) {
    case '/metadata_correction_audit/published':
      return { type: AUDIT_ROUTE_TYPES.PUBLISHED }
    case '/metadata_correction_audit/published/{versionName}':
      return {
        type: AUDIT_ROUTE_TYPES.PUBLISHED,
        publishedVersionName: versionName
      }
    default:
      // Direct Lambda invocations may not include API Gateway's resource value.
      if (versionName !== undefined) {
        return {
          type: AUDIT_ROUTE_TYPES.PUBLISHED,
          publishedVersionName: versionName
        }
      }

      return { type: AUDIT_ROUTE_TYPES.SEARCH }
  }
}

/**
 * Returns one audit run in the requested representation.
 *
 * @param {Object} params Detail response parameters.
 * @param {Object} params.defaultResponseHeaders Shared API response headers.
 * @param {unknown} params.includeDiff Whether to include the native metadata diff.
 * @param {'json'|'html'} params.responseFormat Requested representation.
 * @param {string} params.runId Audit run identifier.
 * @returns {Promise<Object>} API Gateway response.
 */
const getAuditDetailResponse = async ({
  defaultResponseHeaders,
  includeDiff,
  responseFormat,
  runId
}) => {
  const auditDocument = await getMetadataCorrectionAuditByRunId({
    runId,
    includeDiff
  })

  if (responseFormat === 'html') {
    return {
      statusCode: auditDocument ? 200 : 404,
      headers: {
        ...defaultResponseHeaders,
        ...HTML_RESPONSE_HEADERS
      },
      body: renderMetadataCorrectionAuditHtml({
        detail: true,
        items: auditDocument ? [auditDocument] : [],
        message: auditDocument
          ? undefined
          : `Metadata correction audit run not found: ${runId}`,
        title: 'Metadata correction audit detail'
      })
    }
  }

  return {
    statusCode: auditDocument ? 200 : 404,
    headers: {
      ...defaultResponseHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      auditDocument || { error: `Metadata correction audit run not found: ${runId}` },
      null,
      2
    )
  }
}

/**
 * Returns a paginated audit search or published-version report.
 *
 * @param {Object} params List response parameters.
 * @param {Object} params.defaultResponseHeaders Shared API response headers.
 * @param {Object} params.event API Gateway event.
 * @param {unknown} params.includeDiff Whether to include native metadata diffs.
 * @param {unknown} params.limit Requested page size.
 * @param {'json'|'html'} params.responseFormat Requested representation.
 * @param {{type: string, publishedVersionName?: string}} params.route Resolved route.
 * @returns {Promise<Object>} API Gateway response.
 */
const getAuditListResponse = async ({
  defaultResponseHeaders,
  event,
  includeDiff,
  limit,
  responseFormat,
  route
}) => {
  const {
    collectionConceptId,
    keywordConceptUuid,
    action,
    scheme,
    status,
    nativeFormat,
    source,
    startDate,
    endDate,
    paginationToken
  } = event?.queryStringParameters || {}
  const isPublishedAuditRoute = route.type === AUDIT_ROUTE_TYPES.PUBLISHED
  const auditPage = await getMetadataCorrectionAuditLog({
    collectionConceptId,
    keywordConceptUuid,
    action,
    scheme,
    status,
    nativeFormat,
    publishedVersionName: route.publishedVersionName,
    publishedOnly: isPublishedAuditRoute,
    source,
    startDate,
    endDate,
    paginationToken,
    includeDiff,
    limit
  })

  if (responseFormat === 'html') {
    let title

    if (route.publishedVersionName) {
      title = `Published metadata correction audit: ${route.publishedVersionName}`
    } else if (isPublishedAuditRoute) {
      title = 'Published metadata correction audit'
    }

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        ...HTML_RESPONSE_HEADERS
      },
      body: renderMetadataCorrectionAuditHtml({
        collectionConceptId,
        groupByPublishedVersion: isPublishedAuditRoute,
        items: auditPage.items,
        nextPageHref: buildNextPageHref(
          event?.queryStringParameters,
          auditPage.nextPaginationToken
        ),
        showCollectionFilter: !isPublishedAuditRoute,
        showPageHeader: !isPublishedAuditRoute,
        title
      })
    }
  }

  return {
    statusCode: 200,
    headers: {
      ...defaultResponseHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(auditPage, null, 2)
  }
}

/**
 * Read-side audit endpoint for metadata-correction activity.
 *
 * The metadata-correction service stores one DocumentDB document per collection-correction run.
 * This handler exposes those runs for MMT audit search, reporting, and troubleshooting.
 *
 * In practice this is useful for:
 * - local smoke-test verification
 * - troubleshooting correction behavior in deployed environments
 * - lightweight audit/history lookup by collection, keyword uuid, action, scheme, or status
 */

/**
 * Retrieves metadata-correction audit runs from DocumentDB.
 *
 * Supported query parameters:
 * - collectionConceptId
 * - keywordConceptUuid
 * - action
 * - scheme
 * - status
 * - nativeFormat
 * - source
 * - startDate / endDate
 * - paginationToken
 * - includeDiff
 * - format (`json` or `html`)
 * - limit
 *
 * Add `includeDiff=true` to a list or detail request to include native-metadata patches.
 * HTML detail responses include native-metadata patches automatically.
 * A `runId` path parameter returns one detailed audit document.
 *
 * @param {object} event - API Gateway event.
 * @param {object} context - Lambda context.
 * @returns {Promise<object>} API Gateway response object.
 *
 * @example
 * await getMetadataCorrectionAudit({
 *   queryStringParameters: { status: 'applied', limit: '25' }
 * }, context)
 * // { statusCode: 200, body: '{"items":[...],"nextPaginationToken":null}' }
 */
export const getMetadataCorrectionAudit = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  const queryStringParameters = event?.queryStringParameters || {}
  const {
    format,
    includeDiff,
    limit,
    publishedVersionName: queryPublishedVersionName
  } = queryStringParameters
  const route = resolveAuditRoute(event)
  let responseFormat = 'json'

  try {
    responseFormat = normalizeResponseFormat(format)

    if (queryPublishedVersionName !== undefined) {
      throw new Error(
        'Invalid metadata correction audit publishedVersionName: '
        + 'use /metadata_correction_audit/published/{versionName}'
      )
    }

    const requestedIncludeDiff = responseFormat === 'html'
      && route.type === AUDIT_ROUTE_TYPES.DETAIL
      ? true
      : includeDiff
    const requestedLimit = responseFormat === 'html' && !limit ? '10' : limit

    let response

    if (route.type === AUDIT_ROUTE_TYPES.DETAIL) {
      response = await getAuditDetailResponse({
        defaultResponseHeaders,
        includeDiff: requestedIncludeDiff,
        responseFormat,
        runId: route.runId
      })
    } else {
      response = await getAuditListResponse({
        defaultResponseHeaders,
        event,
        includeDiff: requestedIncludeDiff,
        limit: requestedLimit,
        responseFormat,
        route
      })
    }

    return response
  } catch (error) {
    logger.error(`Error retrieving metadata correction audit log, error=${error.toString()}`)

    const isClientError = String(error?.message || '')
      .startsWith('Invalid metadata correction audit')

    const statusCode = isClientError ? 400 : 500

    if (responseFormat === 'html') {
      return {
        headers: {
          ...defaultResponseHeaders,
          ...HTML_RESPONSE_HEADERS
        },
        statusCode,
        body: renderMetadataCorrectionAuditHtml({
          message: error.toString(),
          title: 'Metadata correction audit error'
        })
      }
    }

    return {
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      statusCode,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getMetadataCorrectionAudit
