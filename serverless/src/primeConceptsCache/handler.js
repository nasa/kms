import { getConcepts } from '@/getConcepts/handler'
import { getKeywordsTree } from '@/getKeywordsTree/handler'
import { clearConceptResponseCache } from '@/shared/conceptResponseCache'
import {
  CACHE_VERSION_KEY,
  clearConceptsResponseCache,
  createConceptsResponseCacheKey
} from '@/shared/conceptsResponseCache'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getRedisClient } from '@/shared/getRedisClient'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'
import { primeConcepts } from '@/shared/primeConcepts'
import { primeKeywordTrees } from '@/shared/primeKeywordTrees'
import { clearTreeResponseCache, createTreeResponseCacheKey } from '@/shared/treeResponseCache'

const PRIME_VERSION = 'published'
const PAGE_SIZE = 2000
const FORMATS = ['rdf', 'json', 'csv']
const FALLBACK_MAX_PAGES = 25
/**
 * Parses an environment-backed numeric value as a positive integer.
 *
 * @param {string|number|undefined|null} value - Raw value from env/config.
 * @param {number} fallback - Fallback value when parsing fails.
 * @returns {number} A positive integer.
 */
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value), 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Builds a normalized concepts-cache key using route/query values from a Lambda proxy event.
 *
 * @param {Object} event - API Gateway/Lambda proxy event.
 * @returns {string} Redis cache key for concepts responses.
 */
const createConceptsCacheKeyFromEvent = (event) => {
  const pageNum = parsePositiveInt(event?.queryStringParameters?.page_num, 1)
  const pageSize = parsePositiveInt(event?.queryStringParameters?.page_size, PAGE_SIZE)

  return createConceptsResponseCacheKey({
    version: event?.queryStringParameters?.version || PRIME_VERSION,
    path: event?.resource || event?.path,
    endpointPath: event?.path,
    conceptScheme: event?.pathParameters?.conceptScheme,
    pattern: event?.pathParameters?.pattern,
    pageNum,
    pageSize,
    format: event?.queryStringParameters?.format || 'rdf'
  })
}

/**
 * Builds a normalized tree-cache key using route/query values from a Lambda proxy event.
 *
 * @param {Object} event - API Gateway/Lambda proxy event.
 * @returns {string} Redis cache key for tree responses.
 */
const createTreeCacheKeyFromEvent = (event) => createTreeResponseCacheKey({
  version: event?.queryStringParameters?.version || PRIME_VERSION,
  conceptScheme: event?.pathParameters?.conceptScheme || '',
  filter: event?.queryStringParameters?.filter || ''
})

/**
 * Aggregates prime results and counts warmed vs failed requests.
 *
 * A non-200 response is counted as failure except HTTP 400, which is treated as
 * expected/ignorable during cache warming.
 *
 * @param {Object} params - Aggregation inputs.
 * @param {Array<PromiseSettledResult<{response:{statusCode:number},entry:{label:string,cacheKey:string}}>>} params.settledResults
 * @param {string} params.rejectedLogPrefix - Prefix for rejected promise logs.
 * @param {string} params.non200LogPrefix - Prefix for non-200 response logs.
 * @returns {{warmed:number, failed:number}} Count summary.
 */
const countPrimeResults = ({
  settledResults,
  rejectedLogPrefix,
  non200LogPrefix
}) => {
  let warmed = 0
  let failed = 0

  settledResults.forEach((result) => {
    if (result.status === 'rejected') {
      failed += 1
      logger.error(`${rejectedLogPrefix}${result.reason}`)

      return
    }

    const { response, entry } = result.value
    if (response.statusCode === 200) {
      warmed += 1

      return
    }

    if (response.statusCode !== 400) {
      failed += 1
      logger.error(`${non200LogPrefix}route=${entry.label}, key=${entry.cacheKey}, statusCode=${response.statusCode}`)
    }
  })

  return {
    warmed,
    failed
  }
}

/**
 * Nightly cache-prime job for published concepts endpoints.
 *
 * Behavior:
 * 1. Reads current published version metadata.
 * 2. Compares version marker against Redis marker key.
 * 3. If marker changed, clears old `/concepts`, `/concept`, and `/tree` cache keys.
 * 4. Warms `/concepts`, `/concepts/concept_scheme/{conceptScheme}`, and tree routes.
 * 5. Stores the new marker.
 *
 * The function is idempotent for unchanged published versions and safe to rerun.
 *
 * @async
 * @function primeConceptsCache
 * @returns {Promise<{statusCode:number, body:string}>} Lambda-style response payload.
 */
export const primeConceptsCache = async () => {
  logger.info('[cache-prime] start')
  const redisClient = await getRedisClient()
  if (!redisClient) {
    logger.info('[cache-prime] skip reason=redis_not_configured')

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Redis not configured; cache priming skipped'
      })
    }
  }

  const versionMetadata = await getVersionMetadata(PRIME_VERSION)
  if (!versionMetadata) {
    logger.info('[cache-prime] skip reason=missing_published_version_metadata')

    return {
      statusCode: 404,
      body: JSON.stringify({
        message: 'Published version metadata not found; cache priming skipped'
      })
    }
  }

  const marker = versionMetadata.versionName
  const currentMarker = await redisClient.get(CACHE_VERSION_KEY)
  logger.info(`[cache-prime] marker current=${currentMarker || 'none'} target=${marker}`)
  if (currentMarker === marker) {
    logger.info('[cache-prime] skip reason=already_primed')

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cache already primed for current published version',
        marker
      })
    }
  }

  logger.debug('[cache-prime] checkpoint=before_clear_cache')
  const [deletedConceptsKeys, deletedConceptKeys, deletedTreeKeys] = await Promise.all([
    clearConceptsResponseCache(),
    clearConceptResponseCache(),
    clearTreeResponseCache()
  ])
  const deletedKeys = deletedConceptsKeys + deletedConceptKeys + deletedTreeKeys
  logger.info(`[cache-prime] cleared_keys=${deletedKeys}`)

  const getTotalPagesFromResponse = (response) => {
    const headerValue = response?.headers?.['X-Total-Pages']
      || response?.headers?.['x-total-pages']

    return parsePositiveInt(headerValue, FALLBACK_MAX_PAGES)
  }

  logger.debug('[cache-prime] checkpoint=before_get_concept_scheme_details')
  const schemes = await getConceptSchemeDetails({
    version: PRIME_VERSION
  }) || []
  const { warmSettled, schemeSettled } = await primeConcepts({
    schemes,
    getConcepts,
    createConceptsCacheKeyFromEvent,
    getTotalPagesFromResponse,
    formats: FORMATS,
    primeVersion: PRIME_VERSION,
    pageSize: PAGE_SIZE
  })

  const { treeSettled } = await primeKeywordTrees({
    schemes,
    getKeywordsTree,
    createTreeCacheKeyFromEvent,
    primeVersion: PRIME_VERSION
  })

  const conceptResultsSummary = countPrimeResults({
    settledResults: warmSettled,
    rejectedLogPrefix: 'Cache prime error=',
    non200LogPrefix: 'Cache prime non-200 '
  })

  const schemeResultsSummary = countPrimeResults({
    settledResults: schemeSettled.flatMap((result) => (
      result.status === 'fulfilled'
        ? result.value.map((value) => ({
          status: 'fulfilled',
          value
        }))
        : [result]
    )),
    rejectedLogPrefix: 'Cache prime error=',
    non200LogPrefix: 'Cache prime non-200 '
  })

  const treeResultsSummary = countPrimeResults({
    settledResults: treeSettled,
    rejectedLogPrefix: 'Cache prime tree error=',
    non200LogPrefix: 'Cache prime tree non-200 '
  })

  const warmed = conceptResultsSummary.warmed
    + schemeResultsSummary.warmed
    + treeResultsSummary.warmed
  const failed = conceptResultsSummary.failed
    + schemeResultsSummary.failed
    + treeResultsSummary.failed

  await redisClient.set(CACHE_VERSION_KEY, marker)

  return {
    statusCode: failed > 0 ? 500 : 200,
    body: JSON.stringify({
      marker,
      deletedKeys,
      warmed,
      failed,
      schemes: schemes.length,
      maxPagesFallback: FALLBACK_MAX_PAGES
    })
  }
}
