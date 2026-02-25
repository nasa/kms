import { createClient } from 'redis'

let redisClientPromise
let hasLoggedRedisConfig = false

const { REDIS_ENABLED } = process.env
const { REDIS_HOST } = process.env
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)

export const isRedisConfigured = () => (
  REDIS_ENABLED === 'true' && Boolean(REDIS_HOST) && Number.isInteger(REDIS_PORT)
)

export const getRedisClient = async () => {
  if (!isRedisConfigured()) {
    if (!hasLoggedRedisConfig) {
      hasLoggedRedisConfig = true
      console.log(`Redis disabled or not configured: REDIS_ENABLED=${REDIS_ENABLED}, REDIS_HOST=${REDIS_HOST}, REDIS_PORT=${REDIS_PORT}`)
    }

    return null
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      if (!hasLoggedRedisConfig) {
        hasLoggedRedisConfig = true
        console.log(`Redis configured: host=${REDIS_HOST}, port=${REDIS_PORT}`)
      }

      const client = createClient({
        socket: {
          host: REDIS_HOST,
          port: REDIS_PORT
        }
      })

      client.on('error', (error) => {
        console.error(`Redis client error: ${error}`)
      })

      await client.connect()
      console.log('Redis connected')

      return client
    })().catch((error) => {
      redisClientPromise = null

      console.error(`Redis connect failed: ${error}`)

      return null
    })
  }

  return redisClientPromise
}

export const resetRedisClientStateForTests = () => {
  redisClientPromise = null
  hasLoggedRedisConfig = false
}
