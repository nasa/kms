import nodePath from 'path'

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import { parse } from 'csv/sync'

import { getS3Client } from '@/shared/awsClients'
import { getApplicationConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'

import { createCsv } from './createCsv'
import { createCsvMetadata } from './createCsvMetadata'
import { generateCsvHeaders } from './generateCsvHeaders'
import { getCsvHeaders } from './getCsvHeaders'
import { getLongNamesMap } from './getLongNamesMap'
import { getMaxLengthOfSubArray } from './getMaxLengthOfSubArray'
import { getNarrowers } from './getNarrowers'
import { getNarrowersMap } from './getNarrowersMap'
import { getProviderUrlsMap } from './getProviderUrlsMap'
import { getRootConceptForScheme } from './getRootConceptForScheme'
import { isCsvLongNameFlag } from './isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from './isCsvProviderUrlFlag'
import {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} from './redisCacheKeys'
import {
  clearCachedByPrefix,
  getCachedJsonResponse,
  getRedisClient
} from './redisCacheStore'

const KEYWORD_PATH_SEPARATOR = ' > '
const KEYWORD_DIFF_SKIP_HEADER_ROWS = 2

const FULL_PATH_VALUE_FIELDS = Object.freeze({
  sciencekeywords: [
    'Category',
    'Topic',
    'Term',
    'VariableLevel1',
    'VariableLevel2',
    'VariableLevel3',
    'DetailedVariable'
  ],
  locations: [
    'Category',
    'Type',
    'Subregion1',
    'Subregion2',
    'Subregion3',
    'DetailedLocation'
  ],
  chronounits: [
    'Eon',
    'Era',
    'Period',
    'Epoch',
    'Age',
    'SubAge'
  ],
  rucontenttype: [
    'URLContentType',
    'Type',
    'Subtype'
  ]
})

const SHORT_NAME_OBJECT_FIELDS = Object.freeze({
  platforms: [
    'Category',
    'Class',
    'Type',
    'ShortName'
  ],
  instruments: [
    'Category',
    'Class',
    'Subclass',
    'ShortName'
  ],
  projects: [
    'Category',
    'ShortName'
  ],
  providers: [
    'BucketLevel0',
    'BucketLevel1',
    'BucketLevel2',
    'BucketLevel3',
    'ShortName'
  ],
  idnnode: [
    'ShortName'
  ],
  dataformat: [
    'ShortName'
  ],
  granuledataformat: [
    'ShortName'
  ]
})

const LOOKUP_FULL_PATH_SCHEME_SET = new Set([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange',
  'verticalresolutionrange',
  'productlevelid'
])

const LOOKUP_SHORT_NAME_SCHEME_SET = new Set([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat',
  'granuledataformat'
])

const HISTORICAL_CACHE_FULL_PATH_SCHEME_SET = new Set([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange'
])

const HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET = new Set([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat'
])

const PUBLISHED_CACHE_FULL_PATH_SCHEME_SET = new Set([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange',
  'verticalresolutionrange',
  'productlevelid'
])

const PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET = new Set([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat',
  'granuledataformat'
])

const HISTORICAL_CACHE_BUILD_MARKER_VERSION = 'v1'
const HISTORICAL_CACHE_BUILT_VERSIONS_KEY = `kms:historical_concept:versions:built:${HISTORICAL_CACHE_BUILD_MARKER_VERSION}`

/**
 * Encapsulates every place where KMS keyword behavior still depends on canonical path and slot
 * semantics.
 *
 * Why this class exists:
 * - Redis caches are keyed by canonical lookup values, not by whatever raw shape a caller happens
 *   to have in hand.
 * - KMS schemes are inconsistent at the boundary: some are full-path based, some are short-name
 *   based, some are scalar-value based, and several require sparse slot padding.
 * - Publisher, audit, CSV export, cache rebuild, and CMR query code should not need to know how
 *   provider hierarchy levels, full-path slot order, or publish-diff CSV rows are represented.
 *
 * What this class encapsulates:
 * - Keyword object <-> canonical path translation.
 * - Published and historical Redis cache reads and writes.
 * - Publish-time CSV diffing and keyword-event creation.
 * - CSV generation/export workflows that depend on path slot layout.
 * - CMR collection query construction for scheme-specific keyword lookups.
 *
 * The rest of the codebase should be able to stay object-first and ask higher-level questions
 * such as "give me the published concept for this keyword object" or "export the published CSV
 * snapshots", without needing to know how paths, slots, cache keys, or provider hierarchy fields
 * are laid out internally.
 *
 * Public API summary:
 * - `createCmrCollectionQuery(...)`: Build the CMR request shape for one keyword.
 * - `getCsvForScheme(...)`: Build the CSV payload for one scheme/version.
 * - `getHistoricalConceptByFullPath(...)`: Read a historical concept by canonical full path.
 * - `getHistoricalConceptByKeyword(...)`: Read a historical concept by keyword object.
 * - `getHistoricalConceptByShortName(...)`: Read a historical concept by short name.
 * - `getKeywordPathFromKeywordObject(...)`: Reconstruct a canonical KMS path from an object.
 * - `getPublishedConceptByKeyword(...)`: Read a published concept by keyword object.
 * - `getPublishedConceptByUuid(...)`: Read a published concept by UUID.
 * - `getPublishKeywordEvents(...)`: Compare draft/published CSVs and build keyword events.
 * - `rebuildHistoricalConceptCache(...)`: Rebuild the archived historical Redis cache from S3.
 * - `writePublishedConceptCaches(...)`: Write published Redis caches and CSV snapshots.
 */
export class RedisPathStore {
  /**
   * Creates a store with optional dependency overrides.
   *
   * Callers normally use the shared `redisPathStore` instance, while tests can inject lightweight
   * doubles for Redis and S3 behavior here.
   *
   * @param {object} [params={}] - Dependency overrides, mainly for tests.
   * @param {Function} [params.cachedJsonResponseReader=getCachedJsonResponse] - Redis cache reader.
   * @param {Function} [params.redisClientProvider=getRedisClient] - Lazy Redis client provider.
   * @param {Function} [params.s3ClientProvider=getS3Client] - Lazy S3 client provider.
   *
   * @example
   * const store = new RedisPathStore()
   *
   * @example
   * const store = new RedisPathStore({
   *   cachedJsonResponseReader: async ({ cacheKey }) => fakeCache.get(cacheKey),
   *   redisClientProvider: async () => fakeRedisClient,
   *   s3ClientProvider: () => fakeS3Client
   * })
   */
  constructor({
    cachedJsonResponseReader = getCachedJsonResponse,
    redisClientProvider = getRedisClient,
    s3ClientProvider = getS3Client
  } = {}) {
    this.cachedJsonResponseReader = cachedJsonResponseReader
    this.redisClientProvider = redisClientProvider
    this.s3ClientProvider = s3ClientProvider
  }

  // Public methods (alphabetical)

  /**
   * Builds the CMR collection-search query definition for one keyword.
   *
   * This keeps scheme mapping and provider hierarchy slot handling inside the store so callers do
   * not need to know how KMS keyword paths map onto CMR request fields.
   *
   * @param {object} params - CMR query parameters.
   * @param {string} params.scheme - KMS scheme name.
   * @param {string} [params.uuid] - Keyword UUID for UUID-backed CMR schemes.
   * @param {string} [params.prefLabel] - Keyword prefLabel/short name for label-backed schemes.
   * @param {string} [params.fullPath] - Pipe-delimited keyword path for provider hierarchy queries.
   * @param {boolean} [params.isLeaf] - Whether the keyword is a leaf provider node.
   * @returns {{
   *   cmrScheme: string,
   *   method: 'GET'|'POST',
   *   query: object|string,
   *   queryType: 'uuid'|'prefLabel'|'hierarchy'|'queryString'
   * }} Ready-to-send CMR collection query definition.
   *
   * @example
   * redisPathStore.createCmrCollectionQuery({
   *   scheme: 'sciencekeywords',
   *   uuid: '2e5a401b-1507-4f57-82b8-36557c13b154'
   * })
   *
   * @example
   * redisPathStore.createCmrCollectionQuery({
   *   scheme: 'providers',
   *   prefLabel: 'NZ/NZAI/ANZ',
   *   fullPath: 'ARCHIVER| | | |NZ/NZAI/ANZ',
   *   isLeaf: true
   * })
   */
  createCmrCollectionQuery({
    scheme,
    uuid,
    prefLabel,
    fullPath,
    isLeaf
  }) {
    const cmrScheme = this.#getCmrCollectionSchemeName(scheme)

    if (['science_keywords', 'platform', 'instrument', 'location_keyword'].includes(cmrScheme)) {
      return {
        cmrScheme,
        method: 'POST',
        queryType: 'uuid',
        query: {
          condition: {
            [cmrScheme]: {
              uuid
            }
          }
        }
      }
    }

    if (['project', 'processing_level_id'].includes(cmrScheme)) {
      return {
        cmrScheme,
        method: 'POST',
        queryType: 'prefLabel',
        query: {
          condition: {
            [cmrScheme]: prefLabel
          }
        }
      }
    }

    if (cmrScheme === 'data_center') {
      return {
        cmrScheme,
        method: 'POST',
        queryType: 'hierarchy',
        query: {
          condition: {
            [cmrScheme]: this.#buildCmrHierarchyCondition({
              hierarchyFields: ['level_0', 'level_1', 'level_2', 'level_3'],
              keywordList: this.#getCmrProviderHierarchySegments({
                fullPath,
                isLeaf
              }),
              prefLabelField: isLeaf ? 'short_name' : null,
              prefLabelParam: isLeaf ? prefLabel : null
            })
          }
        }
      }
    }

    return {
      cmrScheme,
      method: 'GET',
      queryType: 'queryString',
      query: `${cmrScheme}=${encodeURIComponent(prefLabel)}`
    }
  }

  /**
   * Builds the complete CSV payload for one concept scheme and version.
   *
   * The store owns the path-oriented parts of CSV generation: loading the hierarchy, walking the
   * concept tree, applying sparse-slot padding rules, appending long-name/provider-url columns,
   * sorting rows, and serializing the finished CSV string.
   *
   * @param {object} params - CSV build parameters.
   * @param {string} params.scheme - KMS scheme name.
   * @param {string} params.version - Graph version to query.
   * @param {string} params.versionName - Human-readable keyword version label.
   * @param {string} params.versionCreationDate - Version creation timestamp for CSV metadata.
   * @returns {Promise<string>} Completed CSV content for the requested scheme/version.
   *
   * @example
   * const csvContent = await redisPathStore.getCsvForScheme({
   *   scheme: 'sciencekeywords',
   *   version: 'published',
   *   versionName: 'KMS 2025-09-15',
   *   versionCreationDate: '2025-09-15T12:00:00Z'
   * })
   */
  async getCsvForScheme({
    scheme,
    version,
    versionName,
    versionCreationDate
  }) {
    const csvMetadata = createCsvMetadata({
      versionName,
      versionCreationDate,
      scheme
    })
    let csvHeaders = await getCsvHeaders(scheme, version)
    const csvHeadersCount = csvHeaders.length
    const csvRows = await this.#getCsvRowsForScheme({
      scheme,
      csvHeadersCount,
      version
    })

    if (csvHeaders.length === 0) {
      const maxColumns = getMaxLengthOfSubArray(csvRows)
      csvHeaders = await generateCsvHeaders(scheme, version, maxColumns)
    }

    this.#sortCsvRows(csvRows)

    return createCsv(csvMetadata, csvHeaders, csvRows)
  }

  /**
   * Reads a historical concept cache entry by canonical full path.
   *
   * @param {object} params - Lookup parameters.
   * @param {string} params.fullPath - Canonical KMS full path.
   * @param {string} params.scheme - KMS scheme name.
   * @param {boolean} [params.bypassCache=false] - Whether to bypass any cache reader shortcuts.
   * @returns {Promise<object|undefined>} Historical concept payload when found.
   *
   * @example
   * const concept = await redisPathStore.getHistoricalConceptByFullPath({
   *   scheme: 'sciencekeywords',
   *   fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
   * })
   */
  async getHistoricalConceptByFullPath({
    fullPath,
    scheme,
    bypassCache = false
  }) {
    if (!fullPath) {
      throw new Error('Missing full path for historical concept lookup')
    }

    if (!scheme) {
      throw new Error('Missing scheme for historical concept lookup')
    }

    const normalizedScheme = this.#normalizeKeywordScheme(scheme)

    if (!HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)) {
      throw new Error(`Historical fullPath lookup is not supported for scheme=${normalizedScheme}`)
    }

    const cachedResponse = await this.cachedJsonResponseReader({
      cacheKey: createConceptResponseCacheKeyByFullPath({
        fullPath: fullPath.toLowerCase(),
        scheme: normalizedScheme
      }),
      entityLabel: 'Historical Concept by fullPath',
      bypassCache
    })

    return this.#parseCachedConceptResponse({
      cachedResponse,
      scheme: normalizedScheme
    })
  }

  /**
   * Reads the historical concept cache using a normalized keyword object or keyword value.
   *
   * This is the object-first entry point callers should prefer when they already have a correction
   * payload or keyword object and do not want to know whether the backing lookup is full-path or
   * short-name based.
   *
   * @param {object} params - Lookup parameters.
   * @param {string} params.scheme - KMS scheme name.
   * @param {Record<string, string>} [params.keywordObject={}] - Canonical keyword object.
   * @param {unknown} [params.keywordValue] - Raw value to normalize when an object is not supplied.
   * @returns {Promise<object|undefined>} Historical concept payload when found.
   *
   * @example
   * const concept = await redisPathStore.getHistoricalConceptByKeyword({
   *   scheme: 'projects',
   *   keywordObject: {
   *     Category: 'S - U',
   *     ShortName: 'SPURS-2'
   *   }
   * })
   */
  async getHistoricalConceptByKeyword({
    scheme,
    keywordObject,
    keywordValue
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const normalizedKeywordObject = this.#resolveLookupKeywordObject({
      scheme: normalizedScheme,
      keywordObject,
      keywordValue
    })

    if (this.#isLookupFullPathScheme(normalizedScheme)) {
      const fullPath = this.#getFullPathLookupValueFromKeywordObject({
        scheme: normalizedScheme,
        keywordObject: normalizedKeywordObject
      })

      if (!fullPath) {
        return undefined
      }

      return this.getHistoricalConceptByFullPath({
        fullPath,
        scheme: normalizedScheme
      })
    }

    if (this.#isLookupShortNameScheme(normalizedScheme)) {
      const shortName = this.#getShortNameLookupValueFromKeywordObject(normalizedKeywordObject)

      if (!shortName) {
        return undefined
      }

      return this.getHistoricalConceptByShortName({
        shortName,
        scheme: normalizedScheme
      })
    }

    return undefined
  }

  /**
   * Reads a historical concept cache entry by short name.
   *
   * @param {object} params - Lookup parameters.
   * @param {string} params.shortName - Short-name lookup value.
   * @param {string} params.scheme - KMS scheme name.
   * @param {boolean} [params.bypassCache=false] - Whether to bypass any cache reader shortcuts.
   * @returns {Promise<object|undefined>} Historical concept payload when found.
   *
   * @example
   * const concept = await redisPathStore.getHistoricalConceptByShortName({
   *   scheme: 'projects',
   *   shortName: 'SPURS-2'
   * })
   */
  async getHistoricalConceptByShortName({
    shortName,
    scheme,
    bypassCache = false
  }) {
    if (!shortName) {
      throw new Error('Missing short name for historical concept lookup')
    }

    if (!scheme) {
      throw new Error('Missing scheme for historical concept lookup')
    }

    const normalizedScheme = this.#normalizeKeywordScheme(scheme)

    if (!HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET.has(normalizedScheme)) {
      throw new Error(`Historical shortName lookup is not supported for scheme=${normalizedScheme}`)
    }

    const cachedResponse = await this.cachedJsonResponseReader({
      cacheKey: createConceptResponseCacheKeyByShortName({
        shortName: shortName.toLowerCase(),
        scheme: normalizedScheme
      }),
      entityLabel: 'Historical Concept by shortName',
      bypassCache
    })

    return this.#parseCachedConceptResponse({
      cachedResponse,
      scheme: normalizedScheme
    })
  }

  /**
   * Returns the canonical KMS path string for a normalized keyword object when the object
   * contains enough non-blank fields to produce a meaningful path.
   *
   * @param {object} params - Path reconstruction parameters.
   * @param {string} params.scheme - KMS scheme name.
   * @param {Record<string, string>} [params.keywordObject={}] - Canonical keyword object.
   * @returns {string|undefined} Canonical KMS path when the object has meaningful values.
   *
   * @example
   * redisPathStore.getKeywordPathFromKeywordObject({
   *   scheme: 'providers',
   *   keywordObject: {
   *     BucketLevel0: 'ARCHIVER',
   *     BucketLevel1: '',
   *     BucketLevel2: '',
   *     BucketLevel3: '',
   *     ShortName: 'NZ/NZAI/ANZ'
   *   }
   * })
   * // 'ARCHIVER >  >  >  > NZ/NZAI/ANZ'
   */
  getKeywordPathFromKeywordObject({
    scheme,
    keywordObject
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)

    if (!keywordObject || typeof keywordObject !== 'object') {
      return undefined
    }

    if (this.#isLookupFullPathScheme(normalizedScheme)) {
      return this.#getFullPathLookupValueFromKeywordObject({
        scheme: normalizedScheme,
        keywordObject
      })
    }

    if (this.#isLookupShortNameScheme(normalizedScheme)) {
      const keywordPath = this.#buildKeywordPathFromObject({
        scheme: normalizedScheme,
        keywordObject
      })

      return this.#splitKeywordPath(keywordPath)
        .some((segment) => this.#trimKeywordPathSegment(segment).length > 0)
        ? keywordPath
        : undefined
    }

    const scalarValue = this.#trimKeywordPathSegment(keywordObject.Value)

    return scalarValue.length > 0 ? scalarValue : undefined
  }

  /**
   * Reads the published concept cache using a normalized keyword object or keyword value.
   *
   * This is the object-first published lookup entry point. Callers can stay agnostic about whether
   * the underlying cache key is full-path based or short-name based.
   *
   * @param {object} params - Lookup parameters.
   * @param {string} params.scheme - KMS scheme name.
   * @param {Record<string, string>} [params.keywordObject={}] - Canonical keyword object.
   * @param {unknown} [params.keywordValue] - Raw value to normalize when an object is not supplied.
   * @returns {Promise<object|undefined>} Published concept payload when found.
   *
   * @example
   * const concept = await redisPathStore.getPublishedConceptByKeyword({
   *   scheme: 'rucontenttype',
   *   keywordObject: {
   *     URLContentType: 'CollectionURL',
   *     Type: 'PROJECT HOME PAGE',
   *     Subtype: ''
   *   }
   * })
   */
  async getPublishedConceptByKeyword({
    scheme,
    keywordObject,
    keywordValue
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const normalizedKeywordObject = this.#resolveLookupKeywordObject({
      scheme: normalizedScheme,
      keywordObject,
      keywordValue
    })

    if (this.#isLookupFullPathScheme(normalizedScheme)) {
      const fullPath = this.#getFullPathLookupValueFromKeywordObject({
        scheme: normalizedScheme,
        keywordObject: normalizedKeywordObject
      })

      if (!fullPath) {
        return undefined
      }

      const cachedResponse = await this.cachedJsonResponseReader({
        cacheKey: createPublishedConceptResponseCacheKeyByFullPath({
          fullPath: fullPath.toLowerCase(),
          scheme: normalizedScheme
        }),
        entityLabel: 'Published Concept by fullPath'
      })

      return this.#parseCachedConceptResponse({
        cachedResponse,
        scheme: normalizedScheme
      })
    }

    if (this.#isLookupShortNameScheme(normalizedScheme)) {
      const shortName = this.#getShortNameLookupValueFromKeywordObject(normalizedKeywordObject)

      if (!shortName) {
        return undefined
      }

      const cachedResponse = await this.cachedJsonResponseReader({
        cacheKey: createPublishedConceptResponseCacheKeyByShortName({
          shortName: shortName.toLowerCase(),
          scheme: normalizedScheme
        }),
        entityLabel: 'Published Concept by shortName'
      })

      return this.#parseCachedConceptResponse({
        cachedResponse,
        scheme: normalizedScheme
      })
    }

    return undefined
  }

  /**
   * Reads a published concept cache entry by UUID.
   *
   * @param {object} params - Lookup parameters.
   * @param {string} params.uuid - Published concept UUID.
   * @param {string} params.scheme - KMS scheme name.
   * @returns {Promise<object|undefined>} Published concept payload when found.
   *
   * @example
   * const concept = await redisPathStore.getPublishedConceptByUuid({
   *   scheme: 'sciencekeywords',
   *   uuid: '2e5a401b-1507-4f57-82b8-36557c13b154'
   * })
   */
  async getPublishedConceptByUuid({
    uuid,
    scheme
  }) {
    if (!uuid) {
      throw new Error('Missing uuid for published concept lookup')
    }

    if (!scheme) {
      throw new Error('Missing scheme for published concept lookup')
    }

    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const cachedResponse = await this.cachedJsonResponseReader({
      cacheKey: createPublishedConceptResponseCacheKeyByUuid({
        uuid,
        scheme: normalizedScheme
      }),
      entityLabel: 'Published Concept by uuid'
    })

    return this.#parseCachedConceptResponse({
      cachedResponse,
      scheme: normalizedScheme
    })
  }

  /**
   * Loads and compares published/draft keyword CSVs for a publish analysis run, then turns the
   * resulting diffs into normalized keyword events for publisher orchestration.
   *
   * @param {object} [params={}] - Publish diff parameters.
   * @param {boolean} [params.blockOnFailure=false] - Whether exhausted scheme failures should throw.
   * @returns {Promise<{
   *   keywordChangesMap: Map<string, object>,
   *   keywordEvents: Array<object>,
   *   keywordChangeSummary: { addedCount: number, removedCount: number, changedCount: number },
   *   failedSchemes: Array<{ notation: string, error: string }>,
   *   totalSchemeCount: number,
   *   keywordChangeCount: number
   * }>} Per-scheme diff results plus summary and failures.
   *
   * @example
   * const result = await redisPathStore.getPublishKeywordEvents({
   *   blockOnFailure: true
   * })
   * // {
   * //   keywordChangesMap: Map(...),
   * //   keywordEvents: [{ EventType: 'UPDATED', ... }],
   * //   keywordChangeSummary: { addedCount: 0, removedCount: 0, changedCount: 1 },
   * //   failedSchemes: [],
   * //   totalSchemeCount: 1,
   * //   keywordChangeCount: 1
   * // }
   */
  async getPublishKeywordEvents({
    blockOnFailure = false
  } = {}) {
    const normalizedPublishedSchemes = await this.#loadConceptSchemes({
      version: 'published'
    })
    const normalizedDraftSchemes = await this.#loadConceptSchemes({
      version: 'draft'
    })
    const publishedNotations = new Set(normalizedPublishedSchemes.map((scheme) => scheme.notation))
    const draftNotations = new Set(normalizedDraftSchemes.map((scheme) => scheme.notation))
    const allNotations = new Set([...publishedNotations, ...draftNotations])
    const failedSchemes = []

    if (allNotations.size === 0) {
      logger.warn('No concept schemes found in either version')

      return {
        keywordChangesMap: new Map(),
        keywordEvents: [],
        keywordChangeSummary: {
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        },
        failedSchemes: [],
        totalSchemeCount: 0,
        keywordChangeCount: 0
      }
    }

    const results = await Array.from(allNotations).reduce(async (resultsPromise, notation) => {
      const sequentialResults = await resultsPromise
      const result = await (async () => {
        const inPublished = publishedNotations.has(notation)
        const inDraft = draftNotations.has(notation)
        let comparison
        let lastError
        const maxRetries = 3

        /* eslint-disable no-await-in-loop */
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            comparison = await this.#getKeywordChangesForScheme({
              notation,
              inPublished,
              inDraft
            })

            const summary = this.#getKeywordChangeSummary(comparison)

            return {
              notation,
              summary,
              comparison
            }
          } catch (error) {
            lastError = error
            logger.warn(`Error processing ${notation} on attempt ${attempt + 1}: ${error.message}`)

            if (attempt === maxRetries) {
              break
            }

            const delayMs = 2 ** attempt * 1000
            await new Promise((resolve) => {
              setTimeout(resolve, delayMs)
            })
          }
        }
        /* eslint-enable no-await-in-loop */

        logger.error(
          `Failed ${notation}: exhausted all ${maxRetries + 1} attempts - ${lastError?.message}`
        )

        failedSchemes.push({
          notation,
          error: lastError?.message || 'Unknown error'
        })

        return null
      })()

      sequentialResults.push(result)

      return sequentialResults
    }, Promise.resolve([]))

    const keywordChangesMap = new Map(
      results
        .filter((result) => result !== null)
        .map((result) => [result.notation, result.comparison])
    )

    const keywordChangeSummary = results.reduce((summary, result) => {
      if (!result) {
        return summary
      }

      return {
        addedCount: summary.addedCount + result.summary.addedCount,
        removedCount: summary.removedCount + result.summary.removedCount,
        changedCount: summary.changedCount + result.summary.changedCount
      }
    }, {
      addedCount: 0,
      removedCount: 0,
      changedCount: 0
    })

    if (failedSchemes.length > 0) {
      const failedSchemeSummary = failedSchemes
        .map(({ notation, error }) => `${notation}: ${error}`)
        .join('; ')

      const failureMessage = (
        `Keyword changes detection failed for ${failedSchemes.length} `
        + `scheme(s): ${failedSchemeSummary}`
      )

      if (blockOnFailure) {
        throw new Error(failureMessage)
      }

      logger.warn(
        `[publisher] ${failureMessage}. `
        + 'Continuing with publish because BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE is disabled.'
      )
    }

    logger.info(
      '[publisher] Keyword changes summary '
      + `schemes=${allNotations.size} `
      + `processed=${keywordChangesMap.size} `
      + `failed=${failedSchemes.length} `
      + `added=${keywordChangeSummary.addedCount} `
      + `removed=${keywordChangeSummary.removedCount} `
      + `changed=${keywordChangeSummary.changedCount}`
    )

    const keywordEvents = this.#createKeywordEvents(keywordChangesMap)
    const keywordChangeCount = (
      keywordChangeSummary.addedCount
      + keywordChangeSummary.removedCount
      + keywordChangeSummary.changedCount
    )

    return {
      keywordChangesMap,
      keywordEvents,
      keywordChangeSummary,
      failedSchemes,
      totalSchemeCount: allNotations.size,
      keywordChangeCount
    }
  }

  /**
   * Rebuilds the Redis historical concept cache from archived CSV snapshots stored in S3.
   *
   * @returns {Promise<{
   *   cacheReady: boolean,
   *   totalVersionCount: number,
   *   pendingVersionCount: number,
   *   processedFileCount: number,
   *   markedVersionCount: number
   * }>} Summary describing the historical cache rebuild result.
   *
   * @example
   * const result = await redisPathStore.rebuildHistoricalConceptCache()
   * // { cacheReady: true, totalVersionCount: 42, pendingVersionCount: 3, ... }
   */
  async rebuildHistoricalConceptCache() {
    const bucketName = this.#resolveHistoricalCacheBucketName()

    const s3Client = this.s3ClientProvider()
    const redisClient = await this.redisClientProvider()

    if (!redisClient) {
      throw new Error('Redis is required to build the historical concept cache.')
    }

    logger.info(`Starting cache build from S3 bucket [${bucketName}].`)

    const phaseTimes = {}

    let phaseStartTime = Date.now()
    const versionDirs = await this.#listVersionDirectories({
      bucketName,
      s3Client
    })
    phaseTimes.listDirectories = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

    if (versionDirs.length === 0) {
      logger.warn('No version directories found in the bucket. Nothing to process.')

      return {
        cacheReady: true,
        totalVersionCount: 0,
        pendingVersionCount: 0,
        processedFileCount: 0,
        markedVersionCount: 0
      }
    }

    const builtVersions = await this.#getBuiltHistoricalVersions({
      redisClient
    })
    const pendingVersionDirs = versionDirs.filter(
      (prefix) => !builtVersions.has(this.#normalizeVersionDirectory(prefix))
    )

    logger.info(
      `[cache-builder] Historical version marker status total=${versionDirs.length} `
      + `built=${builtVersions.size} pending=${pendingVersionDirs.length}`
    )

    if (pendingVersionDirs.length === 0) {
      logger.info('All historical keyword versions are already cached in Redis. Nothing to process.')

      return {
        cacheReady: true,
        totalVersionCount: versionDirs.length,
        pendingVersionCount: 0,
        processedFileCount: 0,
        markedVersionCount: 0
      }
    }

    phaseStartTime = Date.now()
    const listResults = await this.#processBatch({
      items: pendingVersionDirs,
      batchSize: 5,
      processor: async (prefix) => ({
        prefix,
        version: this.#normalizeVersionDirectory(prefix),
        csvFiles: await this.#listCsvFilesInDirectory({
          bucketName,
          prefix,
          s3Client
        })
      })
    })
    phaseTimes.listFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

    const versionCsvGroups = []
    const listFailures = []

    listResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        versionCsvGroups.push(result.value)

        return
      }

      listFailures.push({
        prefix: pendingVersionDirs[index],
        message: result.reason?.message || 'Unknown error'
      })

      logger.error(
        `Failed listing CSV files for version directory [${pendingVersionDirs[index]}]: ${result.reason?.message}`
      )
    })

    const allCsvFiles = versionCsvGroups.flatMap(({ version, csvFiles }) => (
      csvFiles.map((key) => ({
        key,
        version
      }))
    ))

    if (allCsvFiles.length === 0) {
      if (listFailures.length > 0) {
        const errorMessages = listFailures
          .map(({ prefix, message }) => `Directory ${prefix}: ${message}`)
          .join('; ')

        throw new Error(
          `Failed to list CSV files in ${listFailures.length} version directories. `
          + `Historical cache must include all versions. Errors: ${errorMessages}`
        )
      }

      logger.warn('No CSV files found in any version directory. Nothing to process.')

      return {
        cacheReady: true,
        totalVersionCount: versionDirs.length,
        pendingVersionCount: pendingVersionDirs.length,
        processedFileCount: 0,
        markedVersionCount: 0
      }
    }

    logger.info(`Found a total of ${allCsvFiles.length} valid CSV files to process.`)

    phaseStartTime = Date.now()
    logger.info('Processing files in parallel batches of 5.')
    const processingResults = await this.#processBatch({
      items: allCsvFiles,
      batchSize: 5,
      processor: async ({ key }) => {
        const scheme = nodePath.basename(key, '.csv').toLowerCase()
        const csvContent = await this.#getS3ObjectContent({
          bucketName,
          key,
          s3Client
        })
        const {
          cachedCount,
          skipped,
          skipReason
        } = await this.#writeHistoricalConceptCacheFromCsv({
          csvContent,
          scheme,
          redisClient
        })

        /* istanbul ignore next -- supported historical files never resolve to skipped writes */
        if (skipped) {
          logger.info(
            `Skipped historical cache write for [${key}] reason=${skipReason || 'unknown'}`
          )

          return
        }

        logger.info(
          `Successfully processed [${key}] through redisPathStore entries=${cachedCount}.`
        )
      }
    })
    phaseTimes.processFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

    const processingFailures = []
    processingResults.forEach((result, index) => {
      if (result.status !== 'rejected') {
        return
      }

      const failedFile = allCsvFiles[index]
      processingFailures.push({
        ...failedFile,
        message: result.reason?.message || 'Unknown error'
      })

      logger.error(`Failed to process file [${failedFile.key}]: ${result.reason?.message}`)
    })

    const failuresByVersion = processingFailures.reduce((accumulator, failure) => {
      const currentFailures = accumulator.get(failure.version) || 0
      accumulator.set(failure.version, currentFailures + 1)

      return accumulator
    }, new Map())

    let markedVersionCount = 0
    await Promise.all(versionCsvGroups.map(async ({ version, csvFiles }) => {
      if (csvFiles.length === 0) {
        logger.info(
          `[cache-builder] Skipping historical cache version marker version=${version} reason=no-valid-csv-files`
        )

        return
      }

      const failureCount = failuresByVersion.get(version) || 0
      if (failureCount > 0) {
        logger.warn(
          `[cache-builder] Not marking historical cache version built version=${version} `
          + `failedFiles=${failureCount}`
        )

        return
      }

      await this.#markHistoricalVersionBuilt({
        redisClient,
        version
      })

      markedVersionCount += 1
    }))

    if (listFailures.length > 0) {
      const errorMessages = listFailures
        .map(({ prefix, message }) => `Directory ${prefix}: ${message}`)
        .join('; ')

      throw new Error(
        `Failed to list CSV files in ${listFailures.length} version directories. `
        + `Historical cache must include all versions. Errors: ${errorMessages}`
      )
    }

    if (processingFailures.length > 0) {
      const errorDetails = processingFailures
        .map(({ key, message }) => `${key}: ${message}`)
        .join('; ')

      throw new Error(
        `Failed to process ${processingFailures.length} of ${allCsvFiles.length} CSV files. `
        + `Historical cache must include all archived versions. Failed files: ${errorDetails}`
      )
    }

    logger.info(
      `Cache build process completed successfully for bucket [${bucketName}]. `
      + `Processed ${allCsvFiles.length} files. `
      + `Timing: ListDirs=${phaseTimes.listDirectories}s `
      + `ListFiles=${phaseTimes.listFiles}s `
      + `ProcessFiles=${phaseTimes.processFiles}s`
    )

    return {
      cacheReady: true,
      totalVersionCount: versionDirs.length,
      pendingVersionCount: pendingVersionDirs.length,
      processedFileCount: allCsvFiles.length,
      markedVersionCount
    }
  }

  /**
   * Writes the published keyword artifacts for the current published version.
   *
   * This workflow prepares the published Redis concept caches and writes the matching CSV snapshots
   * to the RDF backup bucket so both published artifact families stay in sync.
   *
   * @returns {Promise<{
   *   versionName: string,
   *   schemeCount: number,
   *   uploadedCount: number,
   *   cachedCount: number,
   *   cacheReady: boolean,
   *   schemeResults: Array<object>,
   *   failedSchemes: Array<{ notation: string, error: string }>
   * }>} Summary for the published cache/snapshot write step.
   *
   * @example
   * const result = await redisPathStore.writePublishedConceptCaches()
   * // {
   * //   versionName: 'version-2026-05-14',
   * //   schemeCount: 12,
   * //   uploadedCount: 12,
   * //   cachedCount: 4821,
   * //   cacheReady: true
   * // }
   */
  async writePublishedConceptCaches() {
    const s3ExportDelayMs = parseInt(process.env.S3_EXPORT_DELAY_MS || '100', 10)
    const bucketName = this.#resolvePublishedExportBucketName()
    const s3Client = this.s3ClientProvider()
    const { versionName } = await this.#getVersionMetadata('published')

    if (!versionName) {
      throw new Error('Could not determine published version name.')
    }

    const schemes = await this.#loadConceptSchemes({
      version: 'published'
    })

    if (!schemes || schemes.length === 0) {
      logger.warn('No published concept schemes found to export.')

      return {
        versionName,
        schemeCount: 0,
        uploadedCount: 0,
        cachedCount: 0,
        cacheReady: true,
        schemeResults: [],
        failedSchemes: []
      }
    }

    logger.info(
      `[publisher] Starting published CSV export version=${versionName} bucket=${bucketName} schemes=${schemes.length}`
    )

    const {
      schemeResults,
      failedSchemes,
      cachedCount,
      cacheReady: publishedCacheReady
    } = await this.#writePublishedConceptCachesToRedis({
      schemes
    })

    const uploadFailures = []
    let uploadedCount = 0

    await schemeResults.reduce(
      (previousPromise, schemeResult, index) => previousPromise.then(async () => {
        const {
          notation,
          csvContent,
          cacheReady,
          skipReason
        } = schemeResult

        if (!cacheReady) {
          const errorMessage = [
            `Published concept cache not ready for scheme=${notation}`,
            `reason=${skipReason || 'unknown'}`
          ].join(' ')

          logger.error(`Failed to process scheme ${notation}: ${errorMessage}`)
          uploadFailures.push({
            notation,
            error: errorMessage
          })

          return
        }

        try {
          const s3Key = `${versionName}/${notation}.csv`

          await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: csvContent,
            ContentType: 'text/csv'
          }))

          uploadedCount += 1

          if (s3ExportDelayMs > 0 && index < schemeResults.length - 1) {
            await this.#delay(s3ExportDelayMs)
          }
        } catch (error) {
          logger.error(`Failed to process scheme ${notation}: ${error.message}`)
          uploadFailures.push({
            notation,
            error: error.message
          })
        }
      }),
      Promise.resolve()
    )

    const allFailures = [...failedSchemes, ...uploadFailures]

    if (allFailures.length > 0) {
      throw new Error(`Failed to export CSV for schemes: ${allFailures.map(({ notation }) => notation).join(', ')}`)
    }

    logger.info(
      `[publisher] Completed published CSV export version=${versionName} bucket=${bucketName} schemes=${schemes.length} uploaded=${uploadedCount} cached=${cachedCount} failed=${failedSchemes.length}`
    )

    return {
      versionName,
      schemeCount: schemes.length,
      uploadedCount,
      cachedCount,
      cacheReady: publishedCacheReady,
      schemeResults,
      failedSchemes
    }
  }

  // Private helpers (alphabetical)

  // Private helpers intentionally use lighter-weight comments than the public API.
  // Examples are included on the helpers where the slot/path behavior is easiest to forget.

  // Recursively walks one SKOS branch and turns it into the final CSV row shape.
  // Example: a provider leaf path is padded before long-name/url/uuid columns are appended.
  async #appendHierarchicalCsvRows(params) {
    const {
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n,
      map,
      path,
      paths
    } = params
    const currentPath = Array.isArray(path) ? path : []

    const { narrowerPrefLabel, uri } = n
    const uuid = n.uri?.split('/')[n.uri.split('/').length - 1]
    const longNameValue = longNamesMap[n.uri]
    const providerUrlsValue = providerUrlsMap[n.uri]

    currentPath.push(narrowerPrefLabel)

    const narrowers = getNarrowers(uri, map)
    const isLeaf = narrowers.length === 0

    await Promise.all(narrowers.map((obj) => this.#appendHierarchicalCsvRows({
      ...params,
      n: obj,
      path: [...currentPath]
    })))

    if (currentPath.length > 1) {
      currentPath.shift()

      this.#formatKeywordCsvPath({
        scheme,
        csvHeadersCount,
        path: currentPath,
        isLeaf
      })

      if (isCsvLongNameFlag(scheme)) {
        currentPath.push(longNameValue || '')
      }

      if (isCsvProviderUrlFlag(scheme)) {
        currentPath.push(providerUrlsValue ? providerUrlsValue[0] : '')
      }

      currentPath.push(uuid)
      paths.push(currentPath)
    }
  }

  // Rehydrates a cached concept payload with the normalized keyword object expected by callers.
  #attachKeywordObjectToConcept({
    concept,
    scheme
  }) {
    if (!concept) {
      return undefined
    }

    const baseKeywordObject = concept.fullPath
      ? this.#buildKeywordObjectFromPath({
        scheme,
        keywordPath: concept.fullPath
      })
      : {}

    if (concept.keywordObject && typeof concept.keywordObject === 'object') {
      return {
        ...concept,
        keywordObject: this.#attachSupplementalKeywordFields({
          concept,
          keywordObject: {
            ...baseKeywordObject,
            ...concept.keywordObject
          }
        })
      }
    }

    return {
      ...concept,
      keywordObject: this.#attachSupplementalKeywordFields({
        concept,
        keywordObject: baseKeywordObject
      })
    }
  }

  // Adds long-name and provider-url fields when the cached concept payload has them.
  #attachSupplementalKeywordFields({
    concept,
    keywordObject
  }) {
    const nextKeywordObject = { ...(keywordObject || {}) }

    if (concept.longName && !nextKeywordObject.LongName) {
      nextKeywordObject.LongName = concept.longName
    }

    if (concept.providerUrl && !nextKeywordObject.DataCenterUrl) {
      nextKeywordObject.DataCenterUrl = concept.providerUrl
    }

    return nextKeywordObject
  }

  // Turns parsed CSV/cache records into Redis mSet-ready key/value entries.
  #buildCacheEntries({
    records,
    createCacheKey,
    createResponseBody,
    createUuidCacheKey
  }) {
    const cacheEntries = []

    records.forEach((value, key) => {
      /* istanbul ignore next -- CSV parsers already filter blank keys/values before cache entry creation */
      if (!key || !value) {
        return
      }

      const responseBody = createResponseBody(key, value)

      cacheEntries.push(this.#createCacheEntry({
        cacheKey: createCacheKey(key),
        responseBody
      }))

      if (responseBody?.uuid && createUuidCacheKey) {
        cacheEntries.push(this.#createCacheEntry({
          cacheKey: createUuidCacheKey(responseBody.uuid),
          responseBody
        }))
      }
    })

    return cacheEntries
  }

  // Converts provider hierarchy pieces into the nested CMR condition object.
  // Example: ['ARCHIVER', 'GCMD'] plus short_name becomes { level_0: 'ARCHIVER', short_name: 'GCMD', ignore_case: false }.
  #buildCmrHierarchyCondition({
    hierarchyFields,
    keywordList,
    prefLabelField,
    prefLabelParam
  }) {
    const condition = {}

    for (let index = 0; index < Math.min(hierarchyFields.length, keywordList.length); index += 1) {
      const fieldName = hierarchyFields[index]
      const fieldValue = keywordList[index]

      if (fieldValue != null && fieldValue !== '') {
        condition[fieldName] = fieldValue
      }
    }

    if (prefLabelField != null && prefLabelParam != null) {
      condition[prefLabelField] = prefLabelParam
    }

    condition.ignore_case = false

    return condition
  }

  // Converts a diff path into the event payload keyword object or returns undefined when blank.
  #buildEventKeywordObject({
    scheme,
    keywordPath
  }) {
    const keywordObject = this.#buildKeywordObjectFromPath({
      scheme,
      keywordPath
    })

    return keywordObject && Object.keys(keywordObject).length > 0
      ? keywordObject
      : undefined
  }

  // Builds historical cache entries from one CSV payload.
  #buildHistoricalCacheEntriesFromCsv({
    csvContent,
    scheme
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)

    if (HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)) {
      return {
        cacheEntries: this.#buildCacheEntries({
          records: this.#parseFullPathCsvRecords(csvContent),
          createCacheKey: (fullPath) => createConceptResponseCacheKeyByFullPath({
            fullPath: fullPath.toLowerCase(),
            scheme: normalizedScheme
          }),
          createResponseBody: (fullPath, uuid) => ({
            uuid,
            fullPath
          })
        }),
        skipped: false,
        skipReason: null
      }
    }

    if (HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET.has(normalizedScheme)) {
      return {
        cacheEntries: this.#buildCacheEntries({
          records: this.#parseShortNameCsvRecords({
            csvContent,
            scheme: normalizedScheme
          }),
          createCacheKey: (shortName) => createConceptResponseCacheKeyByShortName({
            shortName: shortName.toLowerCase(),
            scheme: normalizedScheme
          }),
          createResponseBody: (shortName, value) => this.#createShortNameConceptResponseBody(value)
        }),
        skipped: false,
        skipReason: null
      }
    }

    /* istanbul ignore next -- unsupported historical schemes are filtered before this helper is reached */
    return {
      cacheEntries: [],
      skipped: true,
      skipReason: 'unsupported_scheme'
    }
  }

  // Reconstructs the canonical keyword object from a path string.
  // Example: 'ARCHIVER >  >  >  > NZ/NZAI/ANZ' -> { BucketLevel0: 'ARCHIVER', ..., ShortName: 'NZ/NZAI/ANZ' }.
  #buildKeywordObjectFromPath({
    scheme,
    keywordPath
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const normalizedKeywordPath = this.#trimKeywordPathSegment(keywordPath)

    if (normalizedKeywordPath.length === 0) {
      return {}
    }

    const slotFields = this.#getKeywordPathSlotFields(normalizedScheme)

    if (Array.isArray(slotFields)) {
      return this.#buildKeywordPathObjectFromPath({
        scheme: normalizedScheme,
        keywordPath: this.#joinKeywordPath(this.#stripLeadingSchemeLabel({
          normalizedScheme,
          pathSegments: this.#splitKeywordPath(normalizedKeywordPath)
        }))
      })
    }

    if (this.#isLookupShortNameScheme(normalizedScheme)) {
      const keywordObject = this.#buildShortNameKeywordObjectFromPath({
        scheme: normalizedScheme,
        keywordPath: normalizedKeywordPath
      })

      if (Object.keys(keywordObject).length > 0) {
        return keywordObject
      }

      /* istanbul ignore next -- malformed future short-name paths fall back to the final non-empty segment */
      return {
        ShortName: this.#getLastNonEmptySegment(this.#splitKeywordPath(normalizedKeywordPath))
      }
    }

    return {
      Value: normalizedKeywordPath
    }
  }

  // Reconstructs the canonical path from a normalized keyword object.
  // Example: { Category: 'S - U', ShortName: 'SPURS-2' } -> 'S - U > SPURS-2'.
  #buildKeywordPathFromObject({
    scheme,
    keywordObject
  }) {
    const slotFields = this.#getKeywordPathSlotFields(scheme)
    const shortNameObjectFields = this.#getShortNameKeywordObjectFields(scheme)

    if (!Array.isArray(slotFields)) {
      if (Array.isArray(shortNameObjectFields)) {
        const keywordPathSegments = shortNameObjectFields.map(
          (fieldName) => keywordObject?.[fieldName]
        )
        const firstNonEmptyIndex = keywordPathSegments.findIndex(
          (segment) => this.#trimKeywordPathSegment(segment).length > 0
        )

        return this.#joinKeywordPath(
          firstNonEmptyIndex >= 0
            ? keywordPathSegments.slice(firstNonEmptyIndex)
            : keywordPathSegments
        )
      }

      /* istanbul ignore next -- current supported schemes either map slot fields or short-name objects */
      return this.#joinKeywordPath(this.#flattenKeywordPathValue(keywordObject))
    }

    return this.#joinKeywordPath(slotFields.map((fieldName) => keywordObject?.[fieldName]))
  }

  // Maps a canonical path string onto full-path slot fields for schemes like science keywords.
  #buildKeywordPathObjectFromPath({
    scheme,
    keywordPath
  }) {
    return this.#buildKeywordPathObjectFromSegments({
      scheme,
      segments: this.#splitKeywordPath(keywordPath)
    })
  }

  // Pads/truncates a segment list into the slot-based object for a full-path scheme.
  #buildKeywordPathObjectFromSegments({
    scheme,
    segments
  }) {
    const slotFields = this.#getKeywordPathSlotFields(scheme)
    const normalizedInputSegments = Array.isArray(segments) ? segments : []

    /* istanbul ignore next -- callers only route full-path schemes into this helper */
    if (!Array.isArray(slotFields)) {
      return {}
    }

    const normalizedSegments = normalizedInputSegments.map(
      (segment) => this.#trimKeywordPathSegment(segment)
    )
    const paddedSegments = normalizedSegments.slice()

    while (paddedSegments.length < slotFields.length) {
      paddedSegments.push('')
    }

    return slotFields.reduce((keywordPathObject, fieldName, index) => ({
      ...keywordPathObject,
      [fieldName]: paddedSegments[index] || ''
    }), {})
  }

  // Normalizes raw lookup values into the slot-based object for a full-path scheme.
  #buildKeywordPathObjectFromValue({
    scheme,
    keywordValue
  }) {
    const slotFields = this.#getKeywordPathSlotFields(scheme)

    /* istanbul ignore next -- callers only route full-path schemes into this helper */
    if (!Array.isArray(slotFields)) {
      return {}
    }

    if (keywordValue && typeof keywordValue === 'object' && !Array.isArray(keywordValue)) {
      return this.#buildKeywordPathObjectFromSegments({
        scheme,
        segments: slotFields.map((fieldName) => keywordValue[fieldName])
      })
    }

    return this.#buildKeywordPathObjectFromSegments({
      scheme,
      segments: this.#flattenKeywordPathValue(keywordValue)
    })
  }

  // Normalizes arbitrary caller input into the keyword object shape used for cache lookups.
  #buildLookupKeywordObject({
    scheme,
    keywordValue
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const slotFields = this.#getKeywordPathSlotFields(normalizedScheme)

    if (Array.isArray(slotFields)) {
      const keywordObject = this.#buildKeywordPathObjectFromValue({
        scheme: normalizedScheme,
        keywordValue
      })

      return this.#hasKeywordObjectValue(keywordObject) ? keywordObject : {}
    }

    if (this.#isLookupFullPathScheme(normalizedScheme)) {
      const scalarValue = this.#trimKeywordPathSegment(
        typeof keywordValue === 'object' && !Array.isArray(keywordValue)
          ? keywordValue?.Value
          : keywordValue
      )

      return scalarValue.length > 0 ? { Value: scalarValue } : {}
    }

    if (this.#isLookupShortNameScheme(normalizedScheme)) {
      const shortName = this.#buildShortNameLookupValue(keywordValue)

      return shortName.length > 0 ? { ShortName: shortName } : {}
    }

    return {}
  }

  // Builds published cache entries from one CSV payload.
  #buildPublishedCacheEntriesFromCsv({
    csvContent,
    scheme
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const cacheNamespaceScheme = this.#normalizeCacheNamespaceScheme(normalizedScheme)

    if (PUBLISHED_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)) {
      return {
        cacheEntries: this.#buildCacheEntries({
          records: this.#parseFullPathCsvRecords(csvContent),
          createCacheKey: (fullPath) => createPublishedConceptResponseCacheKeyByFullPath({
            fullPath: fullPath.toLowerCase(),
            scheme: normalizedScheme
          }),
          createResponseBody: (fullPath, uuid) => ({
            uuid,
            fullPath
          }),
          createUuidCacheKey: (uuid) => createPublishedConceptResponseCacheKeyByUuid({
            uuid,
            scheme: normalizedScheme
          })
        }),
        skipped: false,
        skipReason: null,
        cacheNamespaceScheme
      }
    }

    if (PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET.has(normalizedScheme)) {
      return {
        cacheEntries: this.#buildCacheEntries({
          records: this.#parseShortNameCsvRecords({
            csvContent,
            scheme: normalizedScheme
          }),
          createCacheKey: (shortName) => createPublishedConceptResponseCacheKeyByShortName({
            shortName: shortName.toLowerCase(),
            scheme: normalizedScheme
          }),
          createResponseBody: (shortName, value) => this.#createShortNameConceptResponseBody(value),
          createUuidCacheKey: (uuid) => createPublishedConceptResponseCacheKeyByUuid({
            uuid,
            scheme: normalizedScheme
          })
        }),
        skipped: false,
        skipReason: null,
        cacheNamespaceScheme
      }
    }

    return {
      cacheEntries: [],
      skipped: true,
      skipReason: 'unsupported_scheme',
      cacheNamespaceScheme
    }
  }

  // Splits a short-name path string and maps the hierarchy into scheme-specific fields.
  #buildShortNameKeywordObjectFromPath({
    scheme,
    keywordPath
  }) {
    return this.#buildShortNameKeywordObjectFromSegments({
      scheme,
      segments: this.#splitKeywordPath(keywordPath)
    })
  }

  // Maps short-name scheme segments into the named object fields used everywhere else.
  #buildShortNameKeywordObjectFromSegments({
    scheme,
    segments
  }) {
    const fieldNames = this.#getShortNameKeywordObjectFields(scheme)
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const normalizedInputSegments = Array.isArray(segments) ? segments : []

    /* istanbul ignore next -- callers only route supported short-name schemes into this helper */
    if (!Array.isArray(fieldNames)) {
      return {}
    }

    const normalizedSegments = normalizedInputSegments.map(
      (segment) => this.#trimKeywordPathSegment(segment)
    )

    if (fieldNames.length === 1) {
      const singleValue = normalizedScheme === 'idnnode'
        ? this.#joinKeywordPath(normalizedSegments)
        : [...normalizedSegments].reverse().find((segment) => segment.length > 0) || ''

      return {
        [fieldNames[0]]: singleValue
      }
    }

    const lastNonEmptyIndex = normalizedSegments.reduce((lastIndex, segment, index) => (
      segment.length > 0 ? index : lastIndex
    ), -1)
    const shortName = lastNonEmptyIndex >= 0 ? normalizedSegments[lastNonEmptyIndex] : ''
    const hierarchySegments = lastNonEmptyIndex >= 0
      ? normalizedSegments.slice(0, lastNonEmptyIndex)
      : normalizedSegments.slice()

    if (normalizedScheme === 'platforms') {
      const hasCategoryPrefix = this.#normalizeKeywordScheme(hierarchySegments[0]) === 'platforms'

      return {
        Category: hasCategoryPrefix ? hierarchySegments[0] || '' : '',
        Class: hasCategoryPrefix ? hierarchySegments[1] || '' : hierarchySegments[0] || '',
        Type: hasCategoryPrefix ? hierarchySegments[2] || '' : hierarchySegments[1] || '',
        ShortName: shortName
      }
    }

    if (normalizedScheme === 'instruments') {
      return {
        Category: hierarchySegments[0] || '',
        Class: hierarchySegments[1] || '',
        Subclass: hierarchySegments[2] || '',
        ShortName: shortName
      }
    }

    if (normalizedScheme === 'projects') {
      return {
        Category: hierarchySegments[0] || '',
        ShortName: shortName
      }
    }

    if (normalizedScheme === 'providers') {
      return {
        BucketLevel0: hierarchySegments[0] || '',
        BucketLevel1: hierarchySegments[1] || '',
        BucketLevel2: hierarchySegments[2] || '',
        BucketLevel3: hierarchySegments[3] || '',
        ShortName: shortName
      }
    }

    /* istanbul ignore next -- no current multi-field short-name scheme relies on the generic fallback */
    const paddedSegments = normalizedSegments.slice()

    while (paddedSegments.length < fieldNames.length) {
      paddedSegments.push('')
    }

    return fieldNames.reduce((keywordObject, fieldName, index) => ({
      ...keywordObject,
      [fieldName]: paddedSegments[index] || ''
    }), {})
  }

  // Picks the best short-name lookup string from whatever shape the caller passed in.
  #buildShortNameLookupValue(keywordValue) {
    return this.#extractShortNameLookupValue(keywordValue)
      || this.#flattenKeywordPathValue(keywordValue)[0]
      || ''
  }

  // Diffs publisher CSV content by UUID and canonical path.
  // Example: identical UUID with different paths becomes one UPDATED event candidate.
  #compareKeywordCsvContent({
    oldCsvContent,
    newCsvContent
  }) {
    const oldRecords = this.#parseKeywordDiffCsvContent(oldCsvContent)
    const newRecords = this.#parseKeywordDiffCsvContent(newCsvContent)
    const addedKeywords = new Map()
    const removedKeywords = new Map()
    const changedKeywords = new Map()

    Array.from(newRecords.entries()).forEach(([uuid, newPath]) => {
      const oldPath = oldRecords.get(uuid)

      if (oldPath === undefined) {
        addedKeywords.set(uuid, {
          oldPath: undefined,
          newPath
        })

        return
      }

      if (oldPath !== newPath) {
        changedKeywords.set(uuid, {
          oldPath,
          newPath
        })
      }
    })

    Array.from(oldRecords.entries()).forEach(([uuid, oldPath]) => {
      if (!newRecords.has(uuid)) {
        removedKeywords.set(uuid, {
          oldPath,
          newPath: undefined
        })
      }
    })

    return {
      addedKeywords,
      removedKeywords,
      changedKeywords
    }
  }

  // Wraps one response body as a Redis cache entry.
  #createCacheEntry({
    cacheKey,
    responseBody
  }) {
    return {
      key: cacheKey,
      value: JSON.stringify(this.#createCacheResponse(responseBody))
    }
  }

  // Standardizes the JSON payload shape stored in Redis.
  #createCacheResponse(bodyData) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    }
  }

  // Converts diff maps into the publish event payloads consumed downstream.
  #createKeywordEvents(keywordChangesMap) {
    const timestamp = new Date().toISOString()
    const metadataSpecification = {
      URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
      Name: 'Kms-Keyword-Event',
      Version: '1.0'
    }

    const keywordEvents = []

    keywordChangesMap.forEach((changes, scheme) => {
      const { addedKeywords, removedKeywords, changedKeywords } = changes

      addedKeywords.forEach((pathInfo, uuid) => {
        keywordEvents.push({
          EventType: 'INSERTED',
          Scheme: scheme,
          UUID: uuid,
          NewKeywordObject: this.#buildEventKeywordObject({
            scheme,
            keywordPath: pathInfo.newPath
          }),
          Timestamp: timestamp,
          MetadataSpecification: metadataSpecification
        })
      })

      removedKeywords.forEach((pathInfo, uuid) => {
        keywordEvents.push({
          EventType: 'DELETED',
          Scheme: scheme,
          UUID: uuid,
          OldKeywordObject: this.#buildEventKeywordObject({
            scheme,
            keywordPath: pathInfo.oldPath
          }),
          Timestamp: timestamp,
          MetadataSpecification: metadataSpecification
        })
      })

      changedKeywords.forEach((pathInfo, uuid) => {
        keywordEvents.push({
          EventType: 'UPDATED',
          Scheme: scheme,
          UUID: uuid,
          OldKeywordObject: this.#buildEventKeywordObject({
            scheme,
            keywordPath: pathInfo.oldPath
          }),
          NewKeywordObject: this.#buildEventKeywordObject({
            scheme,
            keywordPath: pathInfo.newPath
          }),
          Timestamp: timestamp,
          MetadataSpecification: metadataSpecification
        })
      })
    })

    return keywordEvents
  }

  // Builds the short-name concept payload stored in Redis and returned to callers.
  #createShortNameConceptResponseBody({
    uuid,
    fullPath,
    longName,
    providerUrl,
    keywordObject
  }) {
    const responseBody = {
      uuid,
      fullPath,
      keywordObject
    }

    if (longName) {
      responseBody.longName = longName
    }

    if (providerUrl) {
      responseBody.providerUrl = providerUrl
    }

    return responseBody
  }

  // Small async sleep used by publish retry/export throttling flows.
  async #delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  // Pulls a short-name value from primitive or object input.
  #extractShortNameLookupValue(keywordValue) {
    if (keywordValue === undefined || keywordValue === null) {
      return ''
    }

    if (typeof keywordValue === 'string' || typeof keywordValue === 'number') {
      return String(keywordValue)
    }

    return typeof keywordValue?.ShortName === 'string'
      ? keywordValue.ShortName
      : ''
  }

  // Flattens nested arrays/objects into trimmed scalar values for path reconstruction.
  #flattenKeywordPathValue(keywordValue) {
    if (keywordValue === undefined || keywordValue === null) {
      return []
    }

    if (Array.isArray(keywordValue)) {
      return keywordValue.flatMap((value) => this.#flattenKeywordPathValue(value))
    }

    if (typeof keywordValue === 'object') {
      return Object.values(keywordValue).flatMap((value) => this.#flattenKeywordPathValue(value))
    }

    return [this.#trimKeywordPathSegment(keywordValue)]
  }

  // Applies scheme-specific sparse slot rules before a CSV row is finalized.
  // Example: provider leaf rows insert blank bucket levels before the short name.
  #formatKeywordCsvPath({
    scheme,
    csvHeadersCount,
    path,
    isLeaf
  }) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)

    if (['platforms', 'instruments', 'projects'].includes(normalizedScheme)) {
      const maxLevel = csvHeadersCount - 2

      if (maxLevel === path.length) {
        return path
      }

      while (maxLevel > path.length) {
        if (!isLeaf) {
          path.push('')
        } else {
          path.splice(path.length - 1, 0, '')
        }
      }

      return path
    }

    if (
      [
        'sciencekeywords',
        'chronounits',
        'locations',
        'discipline',
        'rucontenttype',
        'measurementname'
      ].includes(normalizedScheme)
    ) {
      const maxLevel = csvHeadersCount - 1

      if (maxLevel === path.length) {
        return path
      }

      if (maxLevel > path.length) {
        while (maxLevel > path.length) {
          path.push('')
        }

        return path
      }
    }

    if (normalizedScheme === 'providers') {
      const maxLevel = csvHeadersCount - 3

      if (maxLevel === path.length) {
        return path
      }

      if ((maxLevel > path.length) && !isLeaf) {
        while (maxLevel > path.length) {
          path.push('')
        }

        return path
      }

      if ((maxLevel > path.length) && isLeaf) {
        while (maxLevel > path.length) {
          path.splice(path.length - 1, 0, '')
        }

        return path
      }
    }

    return path
  }

  // Reads the historical-cache marker set from Redis.
  async #getBuiltHistoricalVersions({
    redisClient
  }) {
    try {
      const versions = await redisClient.sMembers(HISTORICAL_CACHE_BUILT_VERSIONS_KEY)

      return new Set(versions)
    } catch (error) {
      logger.warn(
        `[cache-builder] Failed reading historical cache version markers key=${HISTORICAL_CACHE_BUILT_VERSIONS_KEY} `
        + `error=${error.message}`
      )

      return new Set()
    }
  }

  // Maps KMS scheme names to the CMR collection query field names.
  #getCmrCollectionSchemeName(scheme) {
    switch (String(scheme || '').toLowerCase()) {
      case 'sciencekeywords':
        return 'science_keywords'
      case 'platforms':
        return 'platform'
      case 'instruments':
        return 'instrument'
      case 'locations':
        return 'location_keyword'
      case 'projects':
        return 'project'
      case 'providers':
        return 'data_center'
      case 'productlevelid':
        return 'processing_level_id'
      case 'dataformat':
      case 'granuledataformat':
        return 'granule_data_format'
      default:
        return scheme
    }
  }

  // Splits provider fullPath values into the hierarchy pieces CMR expects.
  // Example: leaf 'ARCHIVER|GCMD| | |GCMD-DAAC' becomes ['ARCHIVER', 'GCMD', ' ', ' '] for hierarchy matching.
  #getCmrProviderHierarchySegments({
    fullPath,
    isLeaf
  }) {
    const segments = String(fullPath || '')
      .split('|')
      .map((segment) => segment.trim())

    if (!isLeaf) {
      return segments
    }

    return segments.length > 1 ? segments.slice(0, -1) : segments
  }

  // Loads roots/maps and returns the fully built CSV row arrays for one scheme.
  async #getCsvRowsForScheme({
    scheme,
    csvHeadersCount,
    version
  }) {
    const csvRows = []
    const roots = await getRootConceptForScheme(scheme, version)
    const narrowersMap = await getNarrowersMap(scheme, version)
    const longNamesMap = await getLongNamesMap(scheme, version)

    let providerUrlsMap = []
    if (this.#normalizeKeywordScheme(scheme) === 'providers') {
      providerUrlsMap = await getProviderUrlsMap(scheme, version)
    }

    await Promise.all((roots || []).map(async (root) => {
      const node = {
        prefLabel: root?.prefLabel?.value,
        narrowerPrefLabel: root?.prefLabel?.value,
        uri: root?.subject?.value
      }

      await this.#appendHierarchicalCsvRows({
        csvHeadersCount,
        providerUrlsMap,
        longNamesMap,
        scheme,
        n: node,
        map: narrowersMap,
        path: [],
        paths: csvRows
      })
    }))

    return csvRows.reverse()
  }

  // Pulls the canonical full-path lookup value from a normalized keyword object.
  #getFullPathLookupValueFromKeywordObject({
    scheme,
    keywordObject
  }) {
    const slotFields = this.#getKeywordPathSlotFields(scheme)

    if (Array.isArray(slotFields)) {
      if (!this.#hasKeywordObjectValue(keywordObject)) {
        return undefined
      }

      return this.#buildKeywordPathFromObject({
        scheme,
        keywordObject
      })
    }

    const scalarValue = this.#trimKeywordPathSegment(keywordObject.Value)

    return scalarValue.length > 0 ? scalarValue : undefined
  }

  // Loads the right pair of published/draft CSVs for one scheme and diffs them.
  async #getKeywordChangesForScheme({
    notation,
    inPublished,
    inDraft
  }) {
    if (inPublished && inDraft) {
      const [publishedCsv, draftCsv] = await Promise.all([
        this.#loadConceptCsv({
          conceptScheme: notation,
          version: 'published'
        }),
        this.#loadConceptCsv({
          conceptScheme: notation,
          version: 'draft'
        })
      ])

      return this.#compareKeywordCsvContent({
        oldCsvContent: publishedCsv,
        newCsvContent: draftCsv
      })
    }

    if (inPublished && !inDraft) {
      const publishedCsv = await this.#loadConceptCsv({
        conceptScheme: notation,
        version: 'published'
      })

      return this.#compareKeywordCsvContent({
        oldCsvContent: publishedCsv,
        newCsvContent: ''
      })
    }

    const draftCsv = await this.#loadConceptCsv({
      conceptScheme: notation,
      version: 'draft'
    })

    return this.#compareKeywordCsvContent({
      oldCsvContent: '',
      newCsvContent: draftCsv
    })
  }

  // Summarizes the counts from one keyword diff result.
  #getKeywordChangeSummary(comparison) {
    return {
      addedCount: comparison.addedKeywords.size,
      removedCount: comparison.removedKeywords.size,
      changedCount: comparison.changedKeywords.size
    }
  }

  // Returns the slot-field order for full-path schemes.
  #getKeywordPathSlotFields(scheme) {
    return FULL_PATH_VALUE_FIELDS[this.#normalizeKeywordScheme(scheme)]
  }

  // Finds the last real segment in a path, ignoring blank slot padding.
  #getLastNonEmptySegment(segments) {
    const normalizedSegments = Array.isArray(segments) ? segments : []

    /* istanbul ignore next -- only malformed fallback paths route here with no usable segments */
    return [...normalizedSegments]
      .reverse()
      .find((segment) => this.#trimKeywordPathSegment(segment).length > 0) || ''
  }

  // Downloads one S3 object body as UTF-8 text.
  async #getS3ObjectContent({
    bucketName,
    key,
    s3Client
  }) {
    logger.debug(`Downloading content from [s3://${bucketName}/${key}].`)
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    }))

    return this.#streamToString(response.Body)
  }

  // Returns the field order for short-name scheme objects.
  #getShortNameKeywordObjectFields(scheme) {
    return SHORT_NAME_OBJECT_FIELDS[this.#normalizeKeywordScheme(scheme)]
  }

  // Pulls the canonical short-name lookup value from a normalized keyword object.
  #getShortNameLookupValueFromKeywordObject(keywordObject) {
    const shortName = this.#trimKeywordPathSegment(keywordObject?.ShortName)

    return shortName.length > 0 ? shortName : undefined
  }

  // Lazy-loads version metadata to avoid making every caller depend on that module.
  async #getVersionMetadata(version) {
    const { getVersionMetadata } = await import('@/shared/getVersionMetadata')

    return getVersionMetadata(version)
  }

  // Returns true when any field in the keyword object still carries a meaningful value.
  #hasKeywordObjectValue(keywordObject) {
    return Object.values(keywordObject || {}).some(
      (value) => this.#trimKeywordPathSegment(value).length > 0
    )
  }

  // Tests whether a scheme is keyed by full-path lookups.
  #isLookupFullPathScheme(scheme) {
    return LOOKUP_FULL_PATH_SCHEME_SET.has(this.#normalizeKeywordScheme(scheme))
  }

  // Tests whether a scheme is keyed by short-name lookups.
  #isLookupShortNameScheme(scheme) {
    return LOOKUP_SHORT_NAME_SCHEME_SET.has(this.#normalizeKeywordScheme(scheme))
  }

  // Joins normalized path segments into the canonical KMS delimiter format.
  #joinKeywordPath(segments) {
    return (Array.isArray(segments) ? segments : [])
      .map((segment) => this.#trimKeywordPathSegment(segment))
      .join(KEYWORD_PATH_SEPARATOR)
  }

  // Lists only the CSV files in one archived version directory that this store knows how to cache.
  async #listCsvFilesInDirectory({
    bucketName,
    prefix,
    s3Client
  }) {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix
    }))

    const csvFiles = (response.Contents || [])
      .map((obj) => obj.Key)
      .filter((key) => key.toLowerCase().endsWith('.csv'))
      .filter((key) => this.#supportsHistoricalCacheScheme(nodePath.basename(key, '.csv')))

    logger.debug(`Found ${csvFiles.length} valid CSV files in [${prefix}].`)

    return csvFiles
  }

  // Lists the top-level archived version directories in the RDF backup bucket.
  async #listVersionDirectories({
    bucketName,
    s3Client
  }) {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Delimiter: '/'
    }))
    const prefixes = (response.CommonPrefixes || []).map((prefix) => prefix.Prefix)
    logger.info(`Found ${prefixes.length} version directories in bucket [${bucketName}].`)

    return prefixes
  }

  // Lazy-loads one scheme/version CSV from the existing downloadConcepts boundary.
  async #loadConceptCsv({
    conceptScheme,
    version
  }) {
    // eslint-disable-next-line import/no-cycle
    const { downloadConcepts } = await import('@/shared/downloadConcepts')

    return downloadConcepts({
      conceptScheme,
      format: 'csv',
      version,
      bypassCache: true
    })
  }

  // Lazy-loads concept-scheme metadata for one graph version.
  async #loadConceptSchemes({
    version
  }) {
    const { getConceptSchemeDetails } = await import('@/shared/getConceptSchemeDetails')
    const schemes = await getConceptSchemeDetails({ version })

    return Array.isArray(schemes) ? schemes : []
  }

  // Writes the version marker after every file for that archived version succeeded.
  async #markHistoricalVersionBuilt({
    redisClient,
    version
  }) {
    /* istanbul ignore next -- version groups are normalized before this helper is reached */
    if (!version) {
      return
    }

    try {
      await redisClient.sAdd(HISTORICAL_CACHE_BUILT_VERSIONS_KEY, version)
      logger.info(`[cache-builder] Marked historical cache version built version=${version}`)
    } catch (error) {
      logger.warn(
        `[cache-builder] Failed writing historical cache version marker version=${version} `
        + `key=${HISTORICAL_CACHE_BUILT_VERSIONS_KEY} error=${error.message}`
      )
    }
  }

  // Normalizes cache namespace aliases like granuledataformat -> dataformat.
  #normalizeCacheNamespaceScheme(scheme) {
    return this.#normalizeKeywordScheme(scheme) === 'granuledataformat'
      ? 'dataformat'
      : this.#normalizeKeywordScheme(scheme)
  }

  // Lowercases scheme names so every downstream branch uses one canonical form.
  #normalizeKeywordScheme(scheme) {
    return String(scheme || '').toLowerCase()
  }

  // Removes trailing slashes from archived version prefixes.
  #normalizeVersionDirectory(prefix) {
    return String(prefix || '').replace(/\/+$/, '')
  }

  // Parses the cached response body and reattaches the normalized keyword object contract.
  #parseCachedConceptResponse({
    cachedResponse,
    scheme
  }) {
    if (!cachedResponse?.body) {
      return undefined
    }

    return this.#attachKeywordObjectToConcept({
      concept: JSON.parse(cachedResponse.body),
      scheme
    })
  }

  // Shared CSV parser for the cache and publish-diff helpers.
  #parseCsv(csvContent) {
    return parse(csvContent, {
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    })
  }

  // Parses full-path CSV rows into fullPath -> uuid records.
  #parseFullPathCsvRecords(csvContent) {
    const rows = this.#parseCsv(csvContent)
    const dataRows = rows.slice(2).filter((row) => row && row.length >= 2)

    return new Map(dataRows.map((row) => {
      const uuid = this.#trimKeywordPathSegment(row[row.length - 1])
      const fullPath = row
        .slice(0, -1)
        .map((column) => this.#trimKeywordPathSegment(column))
        .join(KEYWORD_PATH_SEPARATOR)

      return [fullPath, uuid]
    }))
  }

  // Parses publisher diff CSV content into uuid -> canonical path records.
  #parseKeywordDiffCsvContent(csvContent) {
    const rows = parse(csvContent || '', {
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    })

    const dataRows = rows
      .slice(KEYWORD_DIFF_SKIP_HEADER_ROWS)
      .filter((row) => row && row.length >= 2)

    return new Map(
      dataRows
        .map((row) => {
          const uuid = String(row[row.length - 1] || '').trim()
          const keywordPath = row
            .slice(0, -1)
            .map((column) => String(column || '').trim())
            .join(KEYWORD_PATH_SEPARATOR)

          return [uuid, keywordPath]
        })
        .filter(([uuid]) => uuid.length > 0)
    )
  }

  // Parses short-name CSV rows into shortName -> concept metadata records.
  // Example: provider rows read short name, long name, provider URL, and reconstruct the keyword object from the path columns.
  #parseShortNameCsvRecords({
    csvContent,
    scheme
  }) {
    const rows = this.#parseCsv(csvContent)
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)
    const shortNameColumn = normalizedScheme === 'providers' ? -4 : -3
    const longNameColumn = normalizedScheme === 'providers' ? -3 : -2
    const providerUrlColumn = normalizedScheme === 'providers' ? -2 : null
    const minColumns = normalizedScheme === 'providers' ? 4 : 3
    const dataRows = rows.slice(2).filter((row) => row && row.length >= minColumns)

    return new Map(dataRows
      .map((row) => {
        const uuid = this.#trimKeywordPathSegment(row[row.length - 1])
        const shortName = this.#trimKeywordPathSegment(row[row.length + shortNameColumn])
        const longName = this.#trimKeywordPathSegment(row[row.length + longNameColumn])
        const providerUrl = providerUrlColumn === null
          ? ''
          : this.#trimKeywordPathSegment(row[row.length + providerUrlColumn])
        const pathEndIndex = normalizedScheme === 'providers' ? -3 : -2
        const fullPath = row
          .slice(0, pathEndIndex)
          .map((column) => this.#trimKeywordPathSegment(column))
          .join(KEYWORD_PATH_SEPARATOR)
        const keywordObject = this.#buildKeywordObjectFromPath({
          scheme: normalizedScheme,
          keywordPath: fullPath
        })

        if (longName) {
          keywordObject.LongName = longName
        }

        if (providerUrl) {
          keywordObject.DataCenterUrl = providerUrl
        }

        return [shortName, {
          uuid,
          fullPath,
          longName,
          providerUrl,
          keywordObject
        }]
      })
      .filter(([shortName]) => shortName))
  }

  // Downloads published CSVs for the supplied schemes and writes their published Redis cache entries.
  async #writePublishedConceptCachesToRedis({
    schemes
  }) {
    const normalizedSchemes = Array.isArray(schemes) ? schemes : []

    /* istanbul ignore next -- the public writer returns early when no schemes are available */
    if (normalizedSchemes.length === 0) {
      return {
        schemeResults: [],
        failedSchemes: [],
        cachedCount: 0,
        cacheReady: true
      }
    }

    // eslint-disable-next-line import/no-cycle
    const { downloadConcepts } = await import('@/shared/downloadConcepts')
    const schemeResults = []
    const failedSchemes = []
    let cachedCount = 0

    await normalizedSchemes.reduce(
      (previousPromise, schemeEntry) => previousPromise.then(async () => {
        const notation = typeof schemeEntry === 'string'
          ? schemeEntry
          : schemeEntry?.notation

        if (!notation) {
          return
        }

        try {
          const csvContent = await downloadConcepts({
            conceptScheme: notation,
            format: 'csv',
            version: 'published',
            bypassCache: true
          })

          const cacheResult = await this.#writePublishedConceptCacheFromCsv({
            csvContent,
            scheme: notation
          })

          cachedCount += cacheResult.cachedCount
          schemeResults.push({
            notation,
            csvContent,
            ...cacheResult
          })
        } catch (error) {
          logger.error(
            `[publisher] Failed to prime published cache for scheme ${notation}: ${error.message}`
          )

          failedSchemes.push({
            notation,
            error: error.message
          })
        }
      }),
      Promise.resolve()
    )

    const allSchemesCacheReady = schemeResults.every((result) => result.cacheReady)

    return {
      schemeResults,
      failedSchemes,
      cachedCount,
      cacheReady: failedSchemes.length === 0 && allSchemesCacheReady
    }
  }

  // Runs async work in bounded batches and logs progress between batches.
  async #processBatch({
    items,
    processor,
    batchSize
  }) {
    const results = []

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.allSettled(batch.map(processor))

      results.push(...batchResults)

      logger.info(
        `[cache-builder] Batch progress ${Math.min(i + batchSize, items.length)}/${items.length}`
      )
    }

    return results
  }

  // Resolves the bucket name used for archived historical CSV snapshots.
  #resolveHistoricalCacheBucketName() {
    if (process.env.RDF_BUCKET_NAME) {
      return process.env.RDF_BUCKET_NAME
    }

    const { env } = getApplicationConfig()

    if (env) {
      return `kms-rdf-backup-${env}`
    }

    throw new Error('RDF bucket name is required to rebuild the historical cache')
  }

  // Chooses whether to reuse the supplied keyword object or normalize the raw keyword value.
  #resolveLookupKeywordObject({
    scheme,
    keywordObject,
    keywordValue
  }) {
    if (this.#hasKeywordObjectValue(keywordObject)) {
      return this.#buildLookupKeywordObject({
        scheme,
        keywordValue: keywordObject
      })
    }

    return this.#buildLookupKeywordObject({
      scheme,
      keywordValue
    })
  }

  // Resolves the bucket used for published CSV exports.
  #resolvePublishedExportBucketName() {
    const { env } = getApplicationConfig()

    if (env) {
      return `kms-rdf-backup-${env}`
    }

    throw new Error('Application environment is required to export published CSV snapshots')
  }

  // Sorts final CSV rows lexicographically so exports stay stable.
  #sortCsvRows(paths) {
    const normalizedPaths = Array.isArray(paths) ? paths : []

    normalizedPaths.sort((line1, line2) => {
      for (let i = 0; i < Math.min(line1.length, line2.length); i += 1) {
        if (line1[i] !== line2[i]) {
          return line1[i].localeCompare(line2[i])
        }
      }

      return line1.length - line2.length
    })
  }

  // Splits canonical paths on `>` and trims each slot.
  #splitKeywordPath(keywordPath) {
    return String(keywordPath ?? '')
      .split('>')
      .map((segment) => this.#trimKeywordPathSegment(segment))
  }

  // Reads a Node stream into a UTF-8 string.
  async #streamToString(stream) {
    return new Promise((resolve, reject) => {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    })
  }

  // Removes redundant leading scheme labels from paths like 'Science Keywords > ...'.
  #stripLeadingSchemeLabel({
    normalizedScheme,
    pathSegments
  }) {
    const normalizedPathSegments = Array.isArray(pathSegments) ? pathSegments : []
    const firstSegment = this.#trimKeywordPathSegment(normalizedPathSegments[0]).toLowerCase()

    if (
      normalizedScheme === 'sciencekeywords'
      && (
        firstSegment === normalizedScheme
        || firstSegment === 'science keywords'
      )
    ) {
      return normalizedPathSegments.slice(1)
    }

    return normalizedPathSegments
  }

  // Filters the archived CSV list down to schemes that this store knows how to index historically.
  #supportsHistoricalCacheScheme(scheme) {
    const normalizedScheme = this.#normalizeKeywordScheme(scheme)

    return (
      HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)
      || HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET.has(normalizedScheme)
    )
  }

  // Trims one path segment and normalizes nullish values to empty strings.
  #trimKeywordPathSegment(segment) {
    if (segment === undefined || segment === null) {
      return ''
    }

    return String(segment).trim()
  }

  // Writes cache entries to Redis in bounded mSet batches.
  async #writeCacheEntries({
    cacheEntries,
    redisClient
  }) {
    if (cacheEntries.length === 0) {
      return 0
    }

    const BATCH_SIZE = 1000
    let totalWritten = 0

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < cacheEntries.length; i += BATCH_SIZE) {
      const batch = cacheEntries.slice(i, i + BATCH_SIZE)
      const keyValuePairs = batch.flatMap(({ key, value }) => [key, value])

      await redisClient.mSet(keyValuePairs)
      totalWritten += batch.length
    }
    /* eslint-enable no-await-in-loop */

    return totalWritten
  }

  // Writes one historical CSV payload into Redis using the historical cache key strategy.
  async #writeHistoricalConceptCacheFromCsv({
    csvContent,
    scheme,
    redisClient
  }) {
    const {
      cacheEntries,
      skipped,
      skipReason
    } = this.#buildHistoricalCacheEntriesFromCsv({
      csvContent,
      scheme
    })

    /* istanbul ignore next -- supported historical scheme filtering happens before this helper is called */
    if (skipped) {
      return {
        cachedCount: 0,
        skipped: true,
        skipReason
      }
    }

    const cachedCount = await this.#writeCacheEntries({
      cacheEntries,
      redisClient
    })

    return {
      cachedCount,
      skipped: false,
      skipReason: null
    }
  }

  // Writes one published CSV payload into Redis after clearing the scheme namespace.
  async #writePublishedConceptCacheFromCsv({
    csvContent,
    scheme
  }) {
    const {
      cacheEntries,
      skipped,
      skipReason,
      cacheNamespaceScheme
    } = this.#buildPublishedCacheEntriesFromCsv({
      csvContent,
      scheme
    })

    if (skipped) {
      return {
        cachedCount: 0,
        skipped: true,
        skipReason,
        cacheReady: true,
        cacheNamespaceScheme
      }
    }

    const redisClient = await this.redisClientProvider()

    if (!redisClient) {
      logger.warn(`[publisher] Skipping published concept cache prime scheme=${scheme} reason=redis_unavailable`)

      return {
        cachedCount: 0,
        skipped: true,
        skipReason: 'redis_unavailable',
        cacheReady: false,
        cacheNamespaceScheme
      }
    }

    await clearCachedByPrefix({
      keyPrefix: `kms:${cacheNamespaceScheme}:published_concept`
    })

    const cachedCount = await this.#writeCacheEntries({
      cacheEntries,
      redisClient
    })

    logger.info(
      `[publisher] Primed published concept cache scheme=${scheme} entries=${cachedCount}`
    )

    return {
      cachedCount,
      skipped: false,
      skipReason: null,
      cacheReady: true,
      cacheNamespaceScheme
    }
  }
}

export const redisPathStore = new RedisPathStore()

export default redisPathStore
