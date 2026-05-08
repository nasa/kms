import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/**
 * Local Redis seeding helper for the metadata-correction smoke flow.
 *
 * This script loads the smoke-test fixture and writes the keyword cache entries that the local
 * metadata-correction pipeline depends on. It seeds both:
 * - historical lookups, which resolve an old metadata value back to its historical concept uuid
 * - published lookups, which validate current UMM-C keywords and resolve the latest published path
 *
 * The local smoke test uses this so validation and correction can run entirely against Redis
 * without waiting on external cache propagation.
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const defaultFixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)

const fixturePath = process.argv[2] || process.env.FIXTURE_FILE || defaultFixturePath

// Default Redis settings for the local smoke flow when the caller has not overridden them.
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'true'
process.env.REDIS_HOST = process.env.REDIS_HOST_SERVICE_HOST || process.env.REDIS_HOST || 'localhost'
process.env.REDIS_PORT = process.env.REDIS_HOST_PORT || process.env.REDIS_PORT || '6380'
process.env.REDIS_FAIL_FAST = process.env.REDIS_FAIL_FAST || 'true'

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const historicalConcepts = fixture.historicalConcepts || []
const publishedConcepts = fixture.publishedConcepts || []

if (historicalConcepts.length === 0 && publishedConcepts.length === 0) {
  throw new Error(`No historicalConcepts or publishedConcepts found in fixture ${fixturePath}`)
}

const {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} = await import('../../serverless/src/shared/redisCacheKeys')
const {
  getRedisClient
} = await import('../../serverless/src/shared/redisCacheStore')

const redisClient = await getRedisClient()

if (!redisClient) {
  throw new Error('Unable to connect to Redis for metadata correction cache seeding.')
}

// Store cache values in the same API-response wrapper the shared Redis helpers expect.
const buildCacheResponse = (responseBody) => ({
  statusCode: 200,
  body: JSON.stringify(responseBody)
})

/**
 * Seeds one family of concept lookups into Redis from the local smoke fixture.
 *
 * Historical caches write full-path and short-name entries. Published caches do the same and
 * also add a uuid lookup so correction resolution can find the latest published path by uuid.
 *
 * @param {object} params - Cache seeding configuration.
 * @param {Array<object>} params.concepts - Fixture concept entries to seed.
 * @param {string} params.cacheLabel - Human-readable label for log messages.
 * @param {(args: {fullPath: string, scheme: string}) => string} params.createFullPathCacheKey - Full-path key builder.
 * @param {(args: {shortName: string, scheme: string}) => string} params.createShortNameCacheKey - Short-name key builder.
 * @param {(args: {uuid: string, scheme: string}) => string} [params.createUuidCacheKey] - Optional uuid key builder for published concepts.
 * @returns {Promise<void>}
 */
const seedConcepts = async ({
  concepts,
  cacheLabel,
  createFullPathCacheKey,
  createShortNameCacheKey,
  createUuidCacheKey
}) => Promise.all(concepts.map(async (concept) => {
  const {
    lookupType,
    responseBody,
    scheme
  } = concept

  if (!responseBody?.uuid || !responseBody?.fullPath) {
    throw new Error(
      `${cacheLabel} concept entry for scheme=${scheme} is missing responseBody.uuid or responseBody.fullPath.`
    )
  }

  let cacheKey

  if (lookupType === 'fullPath') {
    cacheKey = createFullPathCacheKey({
      fullPath: concept.fullPath.toLowerCase(),
      scheme: scheme.toLowerCase()
    })
  } else if (lookupType === 'shortName') {
    cacheKey = createShortNameCacheKey({
      shortName: concept.shortName.toLowerCase(),
      scheme: scheme.toLowerCase()
    })
  } else {
    throw new Error(`Unsupported ${cacheLabel} lookupType: ${lookupType}`)
  }

  await redisClient.set(cacheKey, JSON.stringify(buildCacheResponse(responseBody)))

  // Published caches also index by uuid so we can resolve the current published path without RDF4J.
  if (createUuidCacheKey) {
    const uuidCacheKey = createUuidCacheKey({
      uuid: responseBody.uuid.toLowerCase(),
      scheme: scheme.toLowerCase()
    })

    await redisClient.set(uuidCacheKey, JSON.stringify(buildCacheResponse(responseBody)))

    console.log(
      `[seed-metadata-correction-keyword-caches] Seeded ${cacheLabel} uuid entry scheme=${scheme} uuid=${responseBody.uuid} key=${uuidCacheKey}`
    )
  }

  console.log(
    `[seed-metadata-correction-keyword-caches] Seeded ${cacheLabel} ${lookupType} entry scheme=${scheme} uuid=${responseBody.uuid} key=${cacheKey}`
  )
}))

try {
  // Seed historical entries first so old keyword resolution has data to work with.
  if (historicalConcepts.length > 0) {
    await seedConcepts({
      concepts: historicalConcepts,
      cacheLabel: 'historical',
      createFullPathCacheKey: createConceptResponseCacheKeyByFullPath,
      createShortNameCacheKey: createConceptResponseCacheKeyByShortName
    })
  }

  // Seed published entries next so validation and current-path resolution use the latest values.
  if (publishedConcepts.length > 0) {
    await seedConcepts({
      concepts: publishedConcepts,
      cacheLabel: 'published',
      createFullPathCacheKey: createPublishedConceptResponseCacheKeyByFullPath,
      createShortNameCacheKey: createPublishedConceptResponseCacheKeyByShortName,
      createUuidCacheKey: createPublishedConceptResponseCacheKeyByUuid
    })
  }
} finally {
  await redisClient.quit()
}
