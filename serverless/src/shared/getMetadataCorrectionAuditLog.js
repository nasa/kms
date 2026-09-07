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
const AUDIT_SUMMARY_PROJECTION = {
  _id: 1,
  runId: 1,
  collectionConceptId: 1,
  collectionUri: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
  'corrections.scheme': 1,
  'corrections.action': 1,
  'corrections.oldKeywordPath': 1,
  'corrections.newKeywordPath': 1,
  'error.message': 1
}

/**
 * Adds the complete stored diff to list queries only when requested.
 *
 * @param {boolean} includeDiff Whether list results should include native-metadata patches.
 * @returns {Object} MongoDB projection for the audit list query.
 */
const auditSummaryProjection = (includeDiff) => {
  if (!includeDiff) return AUDIT_SUMMARY_PROJECTION

  return {
    ...AUDIT_SUMMARY_PROJECTION,
    metadataDiff: 1
  }
}

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
 * Reduces a stored correction to the old-to-new path information needed in audit search results.
 *
 * @example
 * normalizeAuditChange({
 *   scheme: 'platforms',
 *   action: 'replace',
 *   oldKeywordPath: 'Platforms > GOSAT',
 *   newKeywordPath: 'Platforms > GOSAT - Test1'
 * })
 * // { scheme: 'platforms', action: 'replace', oldKeywordPath: '...', newKeywordPath: '...' }
 *
 * @param {Object} correction Stored correction details.
 * @returns {Object} Compact path change.
 */
const normalizeAuditChange = (correction = {}) => ({
  scheme: correction.scheme,
  action: correction.action,
  oldKeywordPath: correction.oldKeywordPath,
  newKeywordPath: correction.newKeywordPath
})

/**
 * Builds the compact representation returned by paginated audit searches.
 *
 * @param {Object} document Stored audit document.
 * @param {boolean} includeDiff Whether to include the native-metadata diff.
 * @returns {Object} Audit summary suitable for list views.
 */
const normalizeAuditSummary = (document, includeDiff = false) => ({
  runId: document.runId,
  collectionConceptId: document.collectionConceptId,
  collectionUri: document.collectionUri,
  status: document.status,
  updatedAt: document.updatedAt,
  changes: Array.isArray(document.corrections)
    ? document.corrections.map(normalizeAuditChange)
    : [],
  ...(includeDiff && document.metadataDiff ? { metadataDiff: document.metadataDiff } : {}),
  ...(document.error?.message ? { errorMessage: document.error.message } : {})
})

/**
 * Parses the optional flag used to include a potentially large native-metadata diff.
 *
 * @example
 * normalizeIncludeDiff('true') // true
 * normalizeIncludeDiff(undefined) // false
 *
 * @param {unknown} includeDiff Requested flag value.
 * @returns {boolean} Whether the detailed response should include the diff.
 */
const normalizeIncludeDiff = (includeDiff) => {
  if (includeDiff === undefined || includeDiff === null || includeDiff === false) return false
  if (includeDiff === true || includeDiff === 'true') return true
  if (includeDiff === 'false') return false

  throw new Error('Invalid metadata correction audit includeDiff: expected true or false')
}

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
  const shouldIncludeDiff = normalizeIncludeDiff(filters.includeDiff)
  const query = addPaginationTokenToQuery(buildAuditQuery(filters), filters.paginationToken)
  const collection = await getMetadataCorrectionAuditCollection()
  const documents = await collection.find(query, {
    projection: auditSummaryProjection(shouldIncludeDiff)
  })
    .sort({
      createdAt: -1,
      _id: -1
    })
    .limit(limit + 1)
    .toArray()
  const hasNextPage = documents.length > limit
  const pageDocuments = hasNextPage ? documents.slice(0, limit) : documents

  return {
    items: pageDocuments.map((document) => normalizeAuditSummary(document, shouldIncludeDiff)),
    nextPaginationToken: hasNextPage
      ? encodePaginationToken(pageDocuments[pageDocuments.length - 1])
      : null
  }
}

/**
 * Retrieves one complete audit run, excluding the native diff unless explicitly requested.
 *
 * @example
 * await getMetadataCorrectionAuditByRunId({ runId: 'run-1', includeDiff: 'true' })
 * // { runId: 'run-1', status: 'applied', metadataDiff: { ... } }
 *
 * @param {Object} params Detail lookup parameters.
 * @param {string} params.runId Audit run identifier.
 * @param {boolean|string} [params.includeDiff=false] Whether to include the stored metadata patch.
 * @returns {Promise<Object|null>} Detailed audit document or null when it does not exist.
 */
export const getMetadataCorrectionAuditByRunId = async ({
  runId,
  includeDiff = false
} = {}) => {
  if (!runId) {
    throw new Error('Invalid metadata correction audit runId')
  }

  const shouldIncludeDiff = normalizeIncludeDiff(includeDiff)
  const collection = await getMetadataCorrectionAuditCollection()
  const document = await collection.findOne(
    { _id: runId },
    {
      projection: shouldIncludeDiff
        ? { _id: 0 }
        : {
          _id: 0,
          metadataDiff: 0
        }
    }
  )

  return document ? normalizeAuditDocument(document) : null
}

export default getMetadataCorrectionAuditLog
