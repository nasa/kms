import { parse } from 'csv/sync'

import { logger } from './logger'
import { createConceptResponseCacheKeyByShortName } from './redisCacheKeys'
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
 * import { ConceptForShortNameCacheBuilder } from './uuidForShortNameCacheBuilder.js';
 *
 * const builder = new ConceptForShortNameCacheBuilder();
 *
 * // This content would typically be fetched from a source like S3
 * const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
`;
 *
 * const scheme = 'instruments';
 * await builder.processToCache(csvContent, { scheme });
 *
 * // After this runs, the Redis cache will contain keys following the format:
 * // 'kms:<scheme>:historical_concept:short_name:<normalized_short_name>', for example:
 * // 'kms:instruments:historical_concept:short_name:AC-690A'
 * // with a value corresponding to the JSON response for the UUID.
 *
 * // Example for 'providers' scheme:
 * const providersCsv = `"Providers_v1.0.0"
"ACADEMIC","","","","ANU/ICAM","Integrated Catchment Assessment and Management Centre, Australian National University","http://icam.anu.edu.au/","268174c2-14f0-4bfc-9fe7-4ef148a26345"`;
 * await builder.processToCache(providersCsv, { scheme: 'providers' });
 * // This will cache 'kms:providers:historical_concept:short_name:ANU/ICAM'
 */
export class ConceptForShortNameCacheBuilder {
  /**
   * @param {string} pathSeparator - Separator for path elements (default: ' > ')
   */
  constructor(pathSeparator = ' > ') {
    this.pathSeparator = pathSeparator
  }

  /**
   * Parses CSV content and returns a map of short names to UUIDs.
   * @param {string} csvContent - CSV content as a string.
   * @param {object} options
   * @param {string} options.scheme - The scheme ('instruments', 'providers', etc.).
   * @returns {Map<string, {uuid: string, fullPath: string}>} Map with short name as key and an object with uuid and fullPath as value.
   */
  parseCsvContent(csvContent, { scheme }) {
    const rows = parse(csvContent, {
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    })

    // All keyword CSVs have two header rows to skip.
    const skipHeaderRows = 2
    // Column index for the Short_Name (from the end of the row).
    const shortNameColumn = scheme === 'providers' ? -4 : -3
    const minColumns = scheme === 'providers' ? 4 : 3

    // Filter rows that have enough columns for shortName and UUID
    const dataRows = rows.slice(skipHeaderRows).filter((row) => row && row.length >= minColumns)

    const entries = dataRows
      .map((row) => {
        const uuid = row[row.length - 1].trim()
        const shortName = row[row.length + shortNameColumn].trim()

        // For most schemes, the fullPath includes columns up to the Short_Name (exclusive of Long_Name and UUID).
        // For 'providers', the structure is different, so we adjust the end index accordingly.
        const pathEndIndex = scheme === 'providers' ? -3 : -2

        const pathElements = row
          .slice(0, pathEndIndex)
          .map((col) => col.trim())
          .filter((col) => col.length > 0)
        const fullPath = pathElements.join(this.pathSeparator)

        return [shortName, {
          uuid,
          fullPath
        }]
      })
      .filter(([shortName]) => shortName)

    return new Map(entries)
  }

  /**
   * Processes the CSV content and caches the results in Redis.
   * @param {string} csvContent - The CSV content as a string.
   */
  async processToCache(csvContent, { scheme }) {
    const records = this.parseCsvContent(csvContent, { scheme })

    const cacheOperations = []

    records.forEach(({ uuid, fullPath }, shortName) => {
      if (shortName && uuid && fullPath) {
        const cacheKey = createConceptResponseCacheKeyByShortName({
          shortName: shortName.toLowerCase(),
          scheme
        })

        const response = {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uuid,
            fullPath
          })
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
