import { BaseConceptCacheBuilder } from './baseConceptCacheBuilder'
import { createConceptResponseCacheKeyByShortName } from './redisCacheKeys'

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
export class ConceptForShortNameCacheBuilder extends BaseConceptCacheBuilder {
  /**
   * @param {string} pathSeparator - Separator for path elements (default: ' > ')
   */
  constructor(pathSeparator = ' > ') {
    super(pathSeparator)
  }

  /**
   * Parses CSV content and returns a map of short names to UUIDs.
   * @param {string} csvContent - CSV content as a string.
   * @param {object} options
   * @param {string} options.scheme - The scheme ('instruments', 'providers', etc.).
   * @returns {Map<string, {uuid: string, fullPath: string, longName: string}>} Map with short name as key and an object with uuid, fullPath, and longName as value.
   */
  parseCsvContent(csvContent, { scheme }) {
    const rows = this.parseCSV(csvContent)

    // All keyword CSVs have two header rows to skip.
    const skipHeaderRows = 2
    // Column index for the Short_Name (from the end of the row).
    const shortNameColumn = scheme === 'providers' ? -4 : -3
    // Column index for the Long_Name (from the end of the row).
    const longNameColumn = scheme === 'providers' ? -3 : -2
    const minColumns = scheme === 'providers' ? 4 : 3

    // Filter rows that have enough columns for shortName and UUID
    const dataRows = rows.slice(skipHeaderRows).filter((row) => row && row.length >= minColumns)

    const entries = dataRows
      .map((row) => {
        const uuid = row[row.length - 1].trim()
        const shortName = row[row.length + shortNameColumn].trim()
        const longName = row[row.length + longNameColumn].trim()

        // For most schemes, the fullPath includes columns up to the Short_Name (exclusive of Long_Name and UUID).
        // For 'providers', the structure is different, so we adjust the end index accordingly.
        const pathEndIndex = scheme === 'providers' ? -3 : -2

        const pathElements = row
          .slice(0, pathEndIndex)
          .map((col) => col.trim())
        const fullPath = pathElements.join(this.pathSeparator)

        return [shortName, {
          uuid,
          fullPath,
          longName
        }]
      })
      .filter(([shortName]) => shortName)

    return new Map(entries)
  }

  /**
   * Creates the cache key for a short name.
   * @param {string} shortName - The short name.
   * @param {string} scheme - The scheme name.
   * @returns {string} The cache key.
   */
  createCacheKey(shortName, scheme) {
    return createConceptResponseCacheKeyByShortName({
      shortName: shortName.toLowerCase(),
      scheme
    })
  }

  /**
   * Creates the response body for a short name record.
   * @param {string} shortName - The short name (unused, kept for signature compatibility).
   * @param {Object} value - The record value containing uuid, fullPath, and longName.
   * @returns {Object} The response body data.
   */
  createResponseBody(shortName, { uuid, fullPath, longName }) {
    const bodyData = {
      uuid,
      fullPath
    }

    if (longName) {
      bodyData.longName = longName
    }

    return bodyData
  }

  /**
   * Validates that shortName, uuid, and fullPath are present.
   * @param {string} shortName - The short name.
   * @param {Object} value - The record value.
   * @returns {boolean} True if all required values are present.
   */
  shouldCache(shortName, { uuid, fullPath }) {
    return Boolean(shortName && uuid && fullPath)
  }
}
