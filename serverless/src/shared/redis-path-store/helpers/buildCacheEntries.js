/**
 * Expands parsed lookup records into Redis-ready cache entry objects.
 *
 * @param {Object} params The cache-entry build configuration.
 * @param {Map<string, any>} params.records Parsed lookup records keyed by lookup value.
 * @param {(lookupValue: string) => string} params.createCacheKey Builds the Redis key for the
 *   primary lookup entry.
 * @param {(lookupValue: string, record: any) => Object} params.createResponseBody Builds the HTTP
 *   response body that should be cached for the lookup entry.
 * @param {(uuid: string) => string} [params.createUuidCacheKey] Optionally builds an additional
 *   Redis key for UUID-based lookups when the response body contains a UUID.
 * @returns {Array<{key: string, value: string}>} Redis `mSet`-ready cache entries.
 */
export const buildCacheEntries = ({
  records,
  createCacheKey,
  createResponseBody,
  createUuidCacheKey
}) => {
  const createCacheResponse = (bodyData) => ({
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
    value: JSON.stringify(createCacheResponse(responseBody))
  })
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
