/**
 * Writes cache entries to Redis in fixed-size batches and returns the written count.
 *
 * @param {Object} params The cache write input.
 * @param {Array<{key: string, value: string}>} params.cacheEntries Redis `mSet`-ready cache
 *   entries.
 * @param {{mSet: (pairs: string[]) => Promise<any>}} params.redisClient Redis client instance.
 * @returns {Promise<number>} Number of cache entries written.
 */
export const writeCacheEntries = async ({
  cacheEntries,
  redisClient
}) => {
  if (cacheEntries.length === 0) {
    return 0
  }

  const BATCH_SIZE = 1000
  let totalWritten = 0

  for (let index = 0; index < cacheEntries.length; index += BATCH_SIZE) {
    const batch = cacheEntries.slice(index, index + BATCH_SIZE)
    const keyValuePairs = batch.flatMap(({ key, value }) => [key, value])

    // eslint-disable-next-line no-await-in-loop
    await redisClient.mSet(keyValuePairs)
    totalWritten += batch.length
  }

  return totalWritten
}
