import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'
import { METADATA_CORRECTION_AUDIT_STATUSES } from '@/shared/persistMetadataCorrectionAuditLog'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 250

/**
 * Converts the API limit to an integer within the supported page-size range.
 *
 * @example
 * normalizeLimit('500') // 250
 * normalizeLimit(undefined) // 100
 *
 * @param {unknown} limit Requested page size.
 * @returns {number} A page size from 1 through 250.
 */
const normalizeLimit = (limit) => {
  const parsedLimit = Number.parseInt(limit, 10)

  if (Number.isNaN(parsedLimit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(MAX_LIMIT, Math.max(1, parsedLimit))
}

/**
 * Parses an optional date filter and reports which request field was invalid.
 *
 * @example
 * normalizeDate('2026-09-02', 'startDate') // Date for 2026-09-02
 * normalizeDate(undefined, 'startDate') // undefined
 *
 * @param {unknown} value Date-compatible filter value.
 * @param {string} fieldName Filter name used in validation errors.
 * @returns {Date|undefined} Parsed date when supplied.
 */
const normalizeDate = (value, fieldName) => {
  if (!value) {
    return undefined
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid metadata correction audit ${fieldName}`)
  }

  return date
}

/**
 * Decodes the opaque API pagination token into its keyset cursor values.
 *
 * @example
 * decodePaginationToken(encodePaginationToken({
 *   createdAt: new Date('2026-09-02T12:00:00.000Z'),
 *   runId: 'run-2'
 * }))
 * // { createdAt: Date('2026-09-02T12:00:00.000Z'), runId: 'run-2' }
 *
 * @param {string|undefined} paginationToken Base64url token returned by an earlier query.
 * @returns {{createdAt: Date, runId: string}|undefined} Decoded cursor values.
 */
const decodePaginationToken = (paginationToken) => {
  if (!paginationToken) {
    return undefined
  }

  try {
    const parsedToken = JSON.parse(Buffer.from(paginationToken, 'base64url').toString('utf8'))
    const createdAt = normalizeDate(parsedToken.createdAt, 'paginationToken')

    if (!createdAt || typeof parsedToken.runId !== 'string' || !parsedToken.runId) {
      throw new Error('invalid pagination token payload')
    }

    return {
      createdAt,
      runId: parsedToken.runId
    }
  } catch {
    throw new Error('Invalid metadata correction audit paginationToken')
  }
}

/**
 * Encodes the last audit document on a page as an opaque keyset pagination token.
 *
 * @example
 * encodePaginationToken({
 *   createdAt: new Date('2026-09-02T12:00:00.000Z'),
 *   runId: 'run-2'
 * })
 * // Base64url for {"createdAt":"2026-09-02T12:00:00.000Z","runId":"run-2"}
 *
 * @param {{createdAt: Date, runId: string}} document Last document returned on a page.
 * @returns {string} Opaque Base64url pagination token.
 */
const encodePaginationToken = (document) => Buffer.from(JSON.stringify({
  createdAt: document.createdAt.toISOString(),
  runId: document.runId
})).toString('base64url')

/**
 * Maps supported API filters to the fixed MongoDB fields used by audit documents.
 *
 * @example
 * buildAuditQuery({ scheme: 'platforms', status: 'applied' })
 * // {
 * //   $or: [{ 'corrections.scheme': 'platforms' }, { 'trigger.scheme': 'platforms' }],
 * //   status: 'applied'
 * // }
 *
 * @param {Object} filters Validated request filter values.
 * @returns {Object} MongoDB query document.
 */
const buildAuditQuery = (filters) => {
  const query = {}
  const {
    action,
    collectionConceptId,
    endDate,
    keywordConceptUuid,
    nativeFormat,
    publishedVersionName,
    scheme,
    source,
    startDate,
    status
  } = filters

  if (collectionConceptId) query.collectionConceptId = collectionConceptId
  if (action) query['trigger.eventType'] = action
  if (keywordConceptUuid) query['corrections.keywordConceptUuid'] = keywordConceptUuid
  if (nativeFormat) query.nativeFormat = nativeFormat
  if (publishedVersionName) query.publishedVersionName = publishedVersionName
  if (scheme) {
    query.$or = [
      { 'corrections.scheme': scheme },
      { 'trigger.scheme': scheme }
    ]
  }

  if (source) query.source = source

  if (status) {
    if (!METADATA_CORRECTION_AUDIT_STATUSES.includes(status)) {
      throw new Error(`Invalid metadata correction audit status: ${status}`)
    }

    query.status = status
  }

  const normalizedStartDate = normalizeDate(startDate, 'startDate')
  const normalizedEndDate = normalizeDate(endDate, 'endDate')

  if (normalizedStartDate || normalizedEndDate) {
    query.createdAt = {
      ...(normalizedStartDate ? { $gte: normalizedStartDate } : {}),
      ...(normalizedEndDate ? { $lte: normalizedEndDate } : {})
    }
  }

  return query
}

/**
 * Adds a newest-first keyset boundary to a MongoDB audit query.
 *
 * For a token representing `{ createdAt: 2026-09-02, runId: 'run-2' }`, the added condition
 * selects documents older than that date, or lower run ids at the exact same date.
 *
 * @param {Object} query Existing field/date query.
 * @param {string|undefined} paginationToken Opaque cursor from the previous page.
 * @returns {Object} Original query or a query combined with the keyset boundary.
 */
const addPaginationTokenToQuery = (query, paginationToken) => {
  const decodedToken = decodePaginationToken(paginationToken)

  if (!decodedToken) {
    return query
  }

  return {
    $and: [
      query,
      {
        $or: [
          { createdAt: { $lt: decodedToken.createdAt } },
          {
            createdAt: decodedToken.createdAt,
            _id: { $lt: decodedToken.runId }
          }
        ]
      }
    ]
  }
}

/**
 * Removes MongoDB's internal `_id` field from the public API representation.
 *
 * @example
 * normalizeAuditDocument({ _id: 'run-1', runId: 'run-1', status: 'applied' })
 * // { runId: 'run-1', status: 'applied' }
 *
 * @param {Object} document Stored audit document.
 * @returns {Object} Public audit document.
 */
const normalizeAuditDocument = (document) => Object.fromEntries(
  Object.entries(document).filter(([key]) => key !== '_id')
)

/**
 * Returns metadata-correction audit runs using newest-first token pagination.
 *
 * @param {Object} [filters={}] Supported field, date, and pagination filters.
 * @returns {Promise<{items: Array<Object>, nextPaginationToken: string|null}>} Audit page.
 *
 * @example
 * await getMetadataCorrectionAuditLog({ status: 'applied', limit: 25 })
 * // { items: [{ runId: '...', status: 'applied', ... }], nextPaginationToken: '...' }
 */
export const getMetadataCorrectionAuditLog = async (filters = {}) => {
  const collection = await getMetadataCorrectionAuditCollection()

  const limit = normalizeLimit(filters.limit)
  const query = addPaginationTokenToQuery(buildAuditQuery(filters), filters.paginationToken)
  const documents = await collection.find(query)
    .sort({
      createdAt: -1,
      _id: -1
    })
    .limit(limit + 1)
    .toArray()
  const hasNextPage = documents.length > limit
  const pageDocuments = hasNextPage ? documents.slice(0, limit) : documents

  return {
    items: pageDocuments.map(normalizeAuditDocument),
    nextPaginationToken: hasNextPage
      ? encodePaginationToken(pageDocuments[pageDocuments.length - 1])
      : null
  }
}

export default getMetadataCorrectionAuditLog
