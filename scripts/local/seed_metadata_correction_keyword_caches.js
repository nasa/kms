import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const rootDir = path.resolve(import.meta.dirname, '../..')
const defaultFixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)

const fixturePath = process.argv[2] || process.env.FIXTURE_FILE || defaultFixturePath

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
  createPublishedConceptResponseCacheKeyByShortName
} = await import('../../serverless/src/shared/redisCacheKeys')
const {
  getRedisClient
} = await import('../../serverless/src/shared/redisCacheStore')

const redisClient = await getRedisClient()

if (!redisClient) {
  throw new Error('Unable to connect to Redis for metadata correction cache seeding.')
}

const buildCacheResponse = (responseBody) => ({
  statusCode: 200,
  body: JSON.stringify(responseBody)
})

const seedConcepts = async ({
  concepts,
  cacheLabel,
  createFullPathCacheKey,
  createShortNameCacheKey
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

  console.log(
    `[seed-metadata-correction-keyword-caches] Seeded ${cacheLabel} ${lookupType} entry scheme=${scheme} uuid=${responseBody.uuid} key=${cacheKey}`
  )
}))

try {
  if (historicalConcepts.length > 0) {
    await seedConcepts({
      concepts: historicalConcepts,
      cacheLabel: 'historical',
      createFullPathCacheKey: createConceptResponseCacheKeyByFullPath,
      createShortNameCacheKey: createConceptResponseCacheKeyByShortName
    })
  }

  if (publishedConcepts.length > 0) {
    await seedConcepts({
      concepts: publishedConcepts,
      cacheLabel: 'published',
      createFullPathCacheKey: createPublishedConceptResponseCacheKeyByFullPath,
      createShortNameCacheKey: createPublishedConceptResponseCacheKeyByShortName
    })
  }
} finally {
  await redisClient.quit()
}
