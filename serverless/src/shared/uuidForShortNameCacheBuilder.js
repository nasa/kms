import { parse } from 'csv/sync'

import { logger } from './logger'
import { createUuidResponseCacheKeyByShortName } from './redisCacheKeys'
import { setCachedJsonResponse } from './redisCacheStore'

/**
 * Builds a cache of UUIDs from CSV file content for short names.
 * This class is designed to parse a string of CSV data, extract the
 * short name and UUID for each keyword, and store them in a Redis cache.
 *
 * The primary method to use is `processToCache`.
 *
 * @example
 * // Example of building the cache from CSV content
 * import { UuidForShortNameCacheBuilder } from './uuidForShortNameCacheBuilder.js';
 *
 * const builder = new UuidForShortNameCacheBuilder();
 *
 * // This content would typically be fetched from a source like S3
 * const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
`;
 *
 * await builder.processToCache(csvContent);
 *
 * // After this runs, the Redis cache will contain a key like:
 * // 'kms:uuid:AC-690A'
 * // with a value corresponding to the JSON response for the UUID.
 */
export class UuidForShortNameCacheBuilder {
  /**
   * @param {number} skipHeaderRows - Number of header rows to skip (default: 2)
   * @param {string} pathSeparator - Separator for path elements (default: ' > ')
   */
  constructor(skipHeaderRows = 2) {
    this.skipHeaderRows = skipHeaderRows
  }

  /**
   * Parses CSV content and returns a map of short names to UUIDs.
   * @param {string} csvContent - CSV content as a string.
   * @returns {Map<string, string>} Map with short name as key and UUID as value.
   */
  parseCsvContent(csvContent) {
    const rows = parse(csvContent, {
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    })

    // Filter rows that have enough columns for shortName and UUID
    const dataRows = rows.slice(this.skipHeaderRows).filter((row) => row && row.length >= 3)

    const entries = dataRows
      .map((row) => {
        const uuid = row[row.length - 1].trim()
        const shortName = row[row.length - 3].trim()

        return [shortName, uuid]
      })
      .filter(([shortName]) => shortName)

    return new Map(entries)
  }

  /**
   * Processes the CSV content and caches the results in Redis.
   * @param {string} csvContent - The CSV content as a string.
   */
  async processToCache(csvContent, { scheme }) {
    const records = this.parseCsvContent(csvContent)

    const cacheOperations = []

    records.forEach((uuid, shortName) => {
      if (shortName && uuid) {
        const cacheKey = createUuidResponseCacheKeyByShortName({
          shortName,
          scheme
        })

        const response = {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uuid })
        }

        cacheOperations.push(
          setCachedJsonResponse({
            cacheKey,
            response
          }).catch((error) => {
            logger.error(`Error setting cache for ${shortName}: ${error.message}`)
          })
        )
      }
    })

    await Promise.all(cacheOperations)

    logger.debug('Finished processing and caching CSV content.')
  }
}
