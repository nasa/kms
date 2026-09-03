import { VALID_SCHEMES } from '@/shared/constants/validSchemes'
import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'
import { METADATA_CORRECTION_AUDIT_STATUSES } from '@/shared/persistMetadataCorrectionAuditLog'
import { CSV_FIELDS } from '@/shared/redis-path-store/helpers/constants'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 250
const VALID_AUDIT_ACTIONS = new Set([
  'DELETED',
  'INSERTED',
  'MANUAL',
  'UPDATED'
])
const VALID_AUDIT_SCHEMES = new Map([
  ...Object.entries(CSV_FIELDS)
    .filter(([, fields]) => Array.isArray(fields))
    .map(([scheme]) => [scheme.toLowerCase(), scheme]),
  ...VALID_SCHEMES.map((scheme) => [scheme.toLowerCase(), scheme])
])

/**
 * Validates the optional API page size.
 *
 * @example
 * normalizeLimit('25') // 25
 * normalizeLimit(undefined) // 100
 *
 * @param {unknown} limit Requested page size.
 * @returns {number} A page size from 1 through 250.
 */
const normalizeLimit = (limit) => {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT
  }

  const parsedLimit = Number(limit)

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
    throw new Error(`Invalid metadata correction audit limit: expected an integer from 1 to ${MAX_LIMIT}`)
  }

  return parsedLimit
}

/**
 * Normalizes and validates a metadata-correction action filter.
 *
 * @example
 * normalizeAction('updated') // 'UPDATED'
 *
 * @param {unknown} action Requested event action.
 * @returns {string|undefined} Canonical action or undefined when omitted.
 */
const normalizeAction = (action) => {
  if (action === undefined || action === null) return undefined

  const normalizedAction = String(action).trim().toUpperCase()

  if (!VALID_AUDIT_ACTIONS.has(normalizedAction)) {
    throw new Error(`Invalid metadata correction audit action: ${action}`)
  }

  return normalizedAction
}

/**
 * Validates a scheme and returns known stored spellings for case-insensitive API input.
 *
 * @example
 * normalizeScheme('dataformat') // ['DataFormat', 'dataformat']
 * normalizeScheme('platforms') // ['platforms']
 *
 * @param {unknown} scheme Requested KMS keyword scheme.
 * @returns {string[]|undefined} Stored scheme spellings or undefined when omitted.
 */
const normalizeScheme = (scheme) => {
  if (scheme === undefined || scheme === null) return undefined

  const normalizedScheme = String(scheme).trim().toLowerCase()
  const canonicalScheme = VALID_AUDIT_SCHEMES.get(normalizedScheme)

  if (!canonicalScheme) {
    throw new Error(`Invalid metadata correction audit scheme: ${scheme}`)
  }

  return [...new Set([canonicalScheme, normalizedScheme])]
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
  const matchClauses = []
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
  const normalizedAction = normalizeAction(action)
  if (normalizedAction) query['trigger.eventType'] = normalizedAction
  if (keywordConceptUuid) {
    matchClauses.push({
      $or: [
        { 'corrections.keywordConceptUuid': keywordConceptUuid },
        { 'trigger.keywordConceptUuid': keywordConceptUuid }
      ]
    })
  }

  if (nativeFormat) query.nativeFormat = nativeFormat
  if (publishedVersionName) query.publishedVersionName = publishedVersionName
  const normalizedSchemes = normalizeScheme(scheme)
  if (normalizedSchemes) {
    const schemeFilter = normalizedSchemes.length === 1
      ? normalizedSchemes[0]
      : { $in: normalizedSchemes }

    matchClauses.push({
      $or: [
        { 'corrections.scheme': schemeFilter },
        { 'trigger.scheme': schemeFilter }
      ]
    })
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

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    throw new Error('Invalid metadata correction audit date range: startDate must not be after endDate')
  }

  if (normalizedStartDate || normalizedEndDate) {
    query.createdAt = {
      ...(normalizedStartDate ? { $gte: normalizedStartDate } : {}),
      ...(normalizedEndDate ? { $lte: normalizedEndDate } : {})
    }
  }

  const queryClauses = [
    ...(Object.keys(query).length > 0 ? [query] : []),
    ...matchClauses
  ]

  if (queryClauses.length === 0) return {}
  if (queryClauses.length === 1) return queryClauses[0]

  return { $and: queryClauses }
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
  const limit = normalizeLimit(filters.limit)
  const query = addPaginationTokenToQuery(buildAuditQuery(filters), filters.paginationToken)
  const collection = await getMetadataCorrectionAuditCollection()
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
