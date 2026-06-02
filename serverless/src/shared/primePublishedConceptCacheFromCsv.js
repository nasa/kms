import { ConceptForFullPathCacheBuilder } from './conceptForFullPathCacheBuilder'
import { ConceptForShortNameCacheBuilder } from './conceptForShortNameCacheBuilder'
import {
  isPublishedCacheFullPathScheme,
  isPublishedCacheShortNameScheme,
  normalizeKeywordScheme
} from './keywordPaths'
import { logger } from './logger'
import {
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} from './redisCacheKeys'
import { clearCachedByPrefix, getRedisClient } from './redisCacheStore'

/**
 * Publish-time Redis cache priming for the current published keyword set.
 *
 * This module takes the CSV content generated for one published concept scheme and writes the
 * fast lookup entries the application needs at runtime. Unlike the historical cache builder,
 * which walks archived S3 versions, this helper only concerns itself with the current published
 * CSV payload being exported right now.
 *
 * The cache entries written here support:
 * - full-path lookups for supported full-path schemes
 * - short-name lookups for supported short-name schemes
 * - UUID-to-current-published-concept lookups so correction resolution can find the latest path
 */

const normalizePublishedCacheScheme = (scheme) => (
  normalizeKeywordScheme(scheme) === 'granuledataformat'
    ? 'dataformat'
    : normalizeKeywordScheme(scheme)
)

const createResponse = (bodyData) => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(bodyData)
})

const createCacheEntry = ({
  cacheKey,
  responseBody
}) => ({
  key: cacheKey,
  value: JSON.stringify(createResponse(responseBody))
})

const buildCacheEntries = ({
  records,
  createCacheKey,
  createResponseBody,
  createUuidCacheKey
}) => {
  const cacheEntries = []

  records.forEach((value, key) => {
    if (!key || !value) {
      return
    }

    const responseBody = createResponseBody(key, value)

    cacheEntries.push(createCacheEntry({
      cacheKey: createCacheKey(key),
      responseBody
    }))

    if (responseBody?.uuid && createUuidCacheKey) {
      cacheEntries.push(createCacheEntry({
        cacheKey: createUuidCacheKey(responseBody.uuid),
        responseBody
      }))
    }
  })

  return cacheEntries
}

/**
 * Primes current published concept lookup keys from a published CSV payload.
 *
 * This is intentionally separate from the historical cache build: it only writes the
 * lookup keys for the CSV currently being exported from the published graph.
 *
 * @param {object} params - Cache-prime parameters.
 * @param {string} params.csvContent - Published CSV content for one scheme.
 * @param {string} params.scheme - Scheme notation for the CSV.
 * @returns {Promise<{
 *   cachedCount: number,
 *   skipped: boolean,
 *   skipReason: 'redis_unavailable' | 'unsupported_scheme' | null,
 *   cacheReady: boolean
 * }>} Cache summary that tells callers whether Redis-backed published lookups are ready.
 */
export const primePublishedConceptCacheFromCsv = async ({
  csvContent,
  scheme
}) => {
  if (!csvContent || !scheme) {
    throw new Error('csvContent and scheme are required to prime published concept cache')
  }

  const normalizedScheme = normalizeKeywordScheme(scheme)
  const normalizedCacheScheme = normalizePublishedCacheScheme(scheme)
  const redisClient = await getRedisClient()

  if (!redisClient) {
    logger.warn(
      `[publisher] Redis not configured, skipping published concept cache prime scheme=${scheme}`
    )

    return {
      cachedCount: 0,
      skipped: true,
      skipReason: 'redis_unavailable',
      cacheReady: false
    }
  }

  let cacheEntries = []

  if (isPublishedCacheFullPathScheme(normalizedScheme)) {
    const builder = new ConceptForFullPathCacheBuilder()
    const records = builder.parseCsvContent(csvContent)

    cacheEntries = buildCacheEntries({
      records,
      createCacheKey: (fullPath) => createPublishedConceptResponseCacheKeyByFullPath({
        fullPath: fullPath.toLowerCase(),
        scheme
      }),
      createResponseBody: (fullPath, uuid) => builder.createResponseBody(fullPath, uuid),
      createUuidCacheKey: (uuid) => createPublishedConceptResponseCacheKeyByUuid({
        uuid,
        scheme
      })
    })
  } else if (isPublishedCacheShortNameScheme(normalizedScheme)) {
    const builder = new ConceptForShortNameCacheBuilder()
    const records = builder.parseCsvContent(csvContent, {
      scheme: normalizedScheme
    })

    cacheEntries = buildCacheEntries({
      records,
      createCacheKey: (shortName) => createPublishedConceptResponseCacheKeyByShortName({
        shortName: shortName.toLowerCase(),
        scheme
      }),
      createResponseBody: (shortName, value) => builder.createResponseBody(shortName, value),
      createUuidCacheKey: (uuid) => createPublishedConceptResponseCacheKeyByUuid({
        uuid,
        scheme
      })
    })
  } else {
    return {
      cachedCount: 0,
      skipped: true,
      skipReason: 'unsupported_scheme',
      cacheReady: true
    }
  }

  // The published concept cache should mirror only the current published graph. Clear the
  // existing scheme namespace before writing the fresh per-scheme entries so changed/removed
  // keywords do not leave behind stale full-path, short-name, or uuid lookups.
  await clearCachedByPrefix({
    keyPrefix: `kms:${normalizedCacheScheme}:published_concept`
  })

  if (cacheEntries.length === 0) {
    return {
      cachedCount: 0,
      skipped: false,
      skipReason: null,
      cacheReady: true
    }
  }

  const BATCH_SIZE = 1000
  let totalWritten = 0

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < cacheEntries.length; i += BATCH_SIZE) {
    const batch = cacheEntries.slice(i, i + BATCH_SIZE)
    const keyValuePairs = batch.flatMap(({ key, value }) => [key, value])

    await redisClient.mSet(keyValuePairs)
    totalWritten += batch.length
  }
  /* eslint-enable no-await-in-loop */

  logger.info(
    `[publisher] Primed published concept cache scheme=${scheme} entries=${totalWritten}`
  )

  return {
    cachedCount: totalWritten,
    skipped: false,
    skipReason: null,
    cacheReady: true
  }
}

export default primePublishedConceptCacheFromCsv
