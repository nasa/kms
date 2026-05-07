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

if (historicalConcepts.length === 0) {
  throw new Error(`No historicalConcepts found in fixture ${fixturePath}`)
}

const {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName
} = await import('../../serverless/src/shared/redisCacheKeys')
const {
  getRedisClient
} = await import('../../serverless/src/shared/redisCacheStore')

const redisClient = await getRedisClient()

if (!redisClient) {
  throw new Error('Unable to connect to Redis for historical cache seeding.')
}

try {
  await Promise.all(historicalConcepts.map(async (concept) => {
    const {
      lookupType,
      responseBody,
      scheme
    } = concept

    if (!responseBody?.uuid || !responseBody?.fullPath) {
      throw new Error(
        `Historical concept entry for scheme=${scheme} is missing responseBody.uuid or responseBody.fullPath.`
      )
    }

    let cacheKey

    if (lookupType === 'fullPath') {
      cacheKey = createConceptResponseCacheKeyByFullPath({
        fullPath: concept.fullPath.toLowerCase(),
        scheme: scheme.toLowerCase()
      })
    } else if (lookupType === 'shortName') {
      cacheKey = createConceptResponseCacheKeyByShortName({
        shortName: concept.shortName.toLowerCase(),
        scheme: scheme.toLowerCase()
      })
    } else {
      throw new Error(`Unsupported historical lookupType: ${lookupType}`)
    }

    await redisClient.set(cacheKey, JSON.stringify({
      statusCode: 200,
      body: JSON.stringify(responseBody)
    }))

    console.log(
      `[seed-historical-cache] Seeded ${lookupType} entry scheme=${scheme} uuid=${responseBody.uuid} key=${cacheKey}`
    )
  }))
} finally {
  await redisClient.quit()
}
