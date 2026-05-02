import { parse } from 'csv/sync'

import { logger } from './logger'
import { setCachedJsonResponse } from './redisCacheStore'

/**
 * Base class for building concept caches from CSV content.
 * Provides common functionality for parsing CSV files and caching results in Redis.
 *
 * Subclasses should implement:
 * - parseCsvContent(csvContent, options): Parse CSV and return a Map
 * - createCacheKey(key, scheme): Create the appropriate cache key
 * - createResponseBody(value): Create the response body object
 */
export class BaseConceptCacheBuilder {
  /**
   * @param {string} pathSeparator - Separator for path elements (default: ' > ')
   */
  constructor(pathSeparator = ' > ') {
    this.pathSeparator = pathSeparator
  }

  /**
   * Common CSV parsing configuration.
   * @param {string} csvContent - CSV content as a string.
   * @returns {Array<Array<string>>} Parsed CSV rows.
   */
  parseCSV(csvContent) {
    return parse(csvContent, {
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    })
  }

  /**
   * Creates a standardized HTTP response object for caching.
   * @param {Object} bodyData - The data to include in the response body.
   * @returns {Object} A standardized response object with status, headers, and body.
   */
  createResponse(bodyData) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    }
  }

  /**
   * Caches a single record in Redis with error handling.
   * @param {string} cacheKey - The Redis cache key.
   * @param {Object} response - The response object to cache.
   * @param {string} identifier - An identifier for logging purposes.
   * @returns {Promise<void>}
   */
  async cacheRecord(cacheKey, response, identifier) {
    try {
      await setCachedJsonResponse({
        cacheKey,
        response
      })
    } catch (error) {
      logger.error(`Error setting cache for ${identifier}: ${error.message}`)
    }
  }

  /**
   * Processes CSV content and caches all records in Redis.
   * This method orchestrates parsing and caching, delegating specifics to subclass implementations.
   *
   * @param {string} csvContent - The CSV content as a string.
   * @param {Object} options - Options for processing (e.g., scheme).
   */
  async processToCache(csvContent, options) {
    const records = this.parseCsvContent(csvContent, options)

    const cacheOperations = []

    records.forEach((value, key) => {
      if (this.shouldCache(key, value)) {
        const cacheKey = this.createCacheKey(key, options.scheme)
        const bodyData = this.createResponseBody(key, value)
        const response = this.createResponse(bodyData)
        const identifier = this.getIdentifier(key)

        cacheOperations.push(this.cacheRecord(cacheKey, response, identifier))
      }
    })

    await Promise.all(cacheOperations)

    logger.debug('Finished processing and caching CSV content.')
  }

  /**
   * Determines whether a record should be cached.
   * Subclasses can override to add custom validation logic.
   *
   * @param {string} key - The cache key.
   * @param {*} value - The value to cache.
   * @returns {boolean} True if the record should be cached.
   */
  shouldCache(key, value) {
    return Boolean(key && value)
  }

  /**
   * Gets an identifier for logging purposes.
   * Subclasses can override to provide more specific identifiers.
   *
   * @param {string} key - The cache key.
   * @returns {string} An identifier for logging.
   */
  getIdentifier(key) {
    return key
  }

  // Abstract methods that subclasses must implement

  /**
   * Parses CSV content and returns a map of records.
   * Must be implemented by subclasses.
   *
   * @abstract
   * @param {string} csvContent - CSV content as a string.
   * @param {Object} options - Parsing options (e.g., scheme).
   * @returns {Map} Map of parsed records.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseCsvContent(csvContent, options) {
    throw new Error('parseCsvContent must be implemented by subclass')
  }

  /**
   * Creates the appropriate cache key for a record.
   * Must be implemented by subclasses.
   *
   * @abstract
   * @param {string} key - The record key.
   * @param {string} scheme - The scheme name.
   * @returns {string} The cache key.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createCacheKey(key, scheme) {
    throw new Error('createCacheKey must be implemented by subclass')
  }

  /**
   * Creates the response body data for a record.
   * Must be implemented by subclasses.
   *
   * @abstract
   * @param {string} key - The record key.
   * @param {*} value - The record value.
   * @returns {Object} The response body data.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createResponseBody(key, value) {
    throw new Error('createResponseBody must be implemented by subclass')
  }
}
