import { BaseConceptCacheBuilder } from './baseConceptCacheBuilder'
import { createConceptResponseCacheKeyByFullPath } from './redisCacheKeys'

/**
 * Builds a cache of UUIDs from CSV file content.
 * This class is designed to parse a string of CSV data, extract the
 * full path and UUID for each keyword, and store them in a Redis cache.
 *
 * The primary method to use is `processToCache`.
 *
 * @example
 * // Example of building the cache from CSV content
 * import { ConceptForFullPathCacheBuilder } from './uuidForFullPathCacheBuilder.js';
 *
 * const builder = new ConceptForFullPathCacheBuilder();
 *
 * // This content would typically be fetched from a source like S3
 * const csvContent = `"Keyword Version: 23.4","Revision: 2026-03-17T17:34:00.294Z"
"Category","Topic","Term","UUID"
"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","a73f94f7-fa3c-4a2c-871e-7927e0b2a7c4"
"EARTH SCIENCE","BIOSPHERE","","9f4f9641-8692-411a-8c34-315cf118c7c3"
`;
 *
 * const scheme = 'sciencekeywords';
 * await builder.processToCache(csvContent, { scheme });
 *
 * // After this runs, the Redis cache will contain keys following the format:
 * // 'kms:<scheme>:historical_concept:full_path:<normalized_full_path>', for example:
 * // 'kms:sciencekeywords:historical_concept:full_path:EARTH%20SCIENCE%20%3E%20ATMOSPHERE%20%3E%20AEROSOLS'
 * // with a value corresponding to the JSON response for the UUID.
 */
export class ConceptForFullPathCacheBuilder extends BaseConceptCacheBuilder {
  /**
   * @param {number} skipHeaderRows - Number of header rows to skip (default: 2)
   * @param {string} pathSeparator - Separator for path elements (default: ' > ')
   */
  constructor(skipHeaderRows = 2, pathSeparator = ' > ') {
    super(pathSeparator)
    this.skipHeaderRows = skipHeaderRows
  }

  /**
   * Parses CSV content and returns a map of full paths to UUIDs.
   * @param {string} csvContent - CSV content as a string.
   * @returns {Map<string, string>} Map with full path as key and UUID as value.
   */
  parseCsvContent(csvContent) {
    const rows = this.parseCSV(csvContent)

    const dataRows = rows.slice(this.skipHeaderRows).filter((row) => row && row.length >= 2)

    const entries = dataRows.map((row) => {
      const uuid = row[row.length - 1].trim()
      const pathElements = row
        .slice(0, -1)
        .map((col) => col.trim())
      const fullPath = pathElements.join(this.pathSeparator)

      return [fullPath, uuid]
    })

    return new Map(entries)
  }

  /**
   * Creates the cache key for a full path.
   * @param {string} fullPath - The full path.
   * @param {string} scheme - The scheme name.
   * @returns {string} The cache key.
   */
  createCacheKey(fullPath, scheme) {
    return createConceptResponseCacheKeyByFullPath({
      fullPath: fullPath.toLowerCase(),
      scheme
    })
  }

  /**
   * Creates the response body for a full path record.
   * @param {string} fullPath - The full path.
   * @param {string} uuid - The UUID.
   * @returns {Object} The response body data.
   */
  createResponseBody(fullPath, uuid) {
    return {
      uuid,
      fullPath
    }
  }

  /**
   * Validates that both fullPath and uuid are present.
   * @param {string} fullPath - The full path.
   * @param {string} uuid - The UUID.
   * @returns {boolean} True if both values are present.
   */
  shouldCache(fullPath, uuid) {
    return Boolean(fullPath && uuid)
  }
}
