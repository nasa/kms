#!/usr/bin/env node

/**
 * Lists CMR collection concept ids whose native metadata format matches the requested format.
 *
 * Usage:
 *   node scripts/local/list_collection_concept_ids_by_native_format.mjs <sit|uat|prod> [format]
 *
 * Examples:
 *   node scripts/local/list_collection_concept_ids_by_native_format.mjs prod dif10
 *   node scripts/local/list_collection_concept_ids_by_native_format.mjs sit echo10
 *   node scripts/local/list_collection_concept_ids_by_native_format.mjs uat application/dif10+xml
 *
 * Optional environment variables:
 *   CMR_PAGE_SIZE   Results per request. Defaults to 2000, matching the CMR Search API max.
 *   CMR_MAX_PAGES   Stop after this many pages. Helpful for quick verification runs.
 *   CMR_CLIENT_ID   Client-Id header value. Defaults to `kms-local-script`.
 *
 * Notes:
 * - This uses `collections.umm_json` because the native format is exposed under `item.meta.format`.
 * - It pages with `CMR-Search-After`, which the current CMR docs recommend over `page_num`.
 * - Progress is written to stderr so stdout stays a clean JSON array of concept ids.
 */

const ENVIRONMENT_BASE_URLS = {
  sit: 'https://cmr.sit.earthdata.nasa.gov',
  uat: 'https://cmr.uat.earthdata.nasa.gov',
  prod: 'https://cmr.earthdata.nasa.gov'
}

const FORMAT_ALIASES = {
  dif10: 'application/dif10+xml',
  echo10: 'application/echo10+xml',
  umm: 'application/vnd.nasa.cmr.umm+json'
}

/**
 * Prints usage text and exits.
 *
 * @param {number} exitCode Process exit code.
 * @returns {never} Always exits the process.
 */
const showUsageAndExit = (exitCode) => {
  const message = [
    'Usage:',
    '  node scripts/local/list_collection_concept_ids_by_native_format.mjs <sit|uat|prod> [format]',
    '',
    'Examples:',
    '  node scripts/local/list_collection_concept_ids_by_native_format.mjs prod dif10',
    '  node scripts/local/list_collection_concept_ids_by_native_format.mjs sit echo10',
    '  node scripts/local/list_collection_concept_ids_by_native_format.mjs uat application/dif10+xml'
  ].join('\n')

  const output = exitCode === 0 ? process.stdout : process.stderr
  output.write(`${message}\n`)
  process.exit(exitCode)
}

/**
 * Resolves the requested CMR environment to its search endpoint base URL.
 *
 * @param {string|undefined} environmentArg CLI environment argument.
 * @returns {{environment: string, baseUrl: string}} Normalized environment plus base URL.
 */
const resolveEnvironment = (environmentArg) => {
  const environment = String(environmentArg || '').trim().toLowerCase()
  const baseUrl = ENVIRONMENT_BASE_URLS[environment]

  if (!baseUrl) {
    throw new Error(`Unsupported environment "${environmentArg}". Expected one of: sit, uat, prod`)
  }

  return {
    environment,
    baseUrl
  }
}

/**
 * Resolves the requested native-format selector to the exact CMR `meta.format` value.
 *
 * Friendly aliases like `dif10` and `echo10` are supported, and callers may also pass the
 * exact MIME type directly.
 *
 * @param {string|undefined} formatArg CLI format argument.
 * @returns {{formatArg: string, nativeFormat: string}} Display label plus exact native format.
 */
const resolveNativeFormat = (formatArg) => {
  const normalizedArg = String(formatArg || 'dif10').trim().toLowerCase()

  if (FORMAT_ALIASES[normalizedArg]) {
    return {
      formatArg: normalizedArg,
      nativeFormat: FORMAT_ALIASES[normalizedArg]
    }
  }

  if (normalizedArg.includes('/')) {
    return {
      formatArg: normalizedArg,
      nativeFormat: String(formatArg).trim()
    }
  }

  throw new Error(
    `Unsupported format "${formatArg}". Use dif10, echo10, umm, or pass an exact MIME type.`
  )
}

/**
 * Parses a positive integer from an environment variable, with a default fallback.
 *
 * @param {string|undefined} value Raw environment variable value.
 * @param {number} defaultValue Fallback value when the env var is absent.
 * @returns {number} Parsed positive integer.
 */
const parsePositiveInteger = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}"`)
  }

  return parsed
}

/**
 * Builds the UMM JSON search URL for one page of collection results.
 *
 * @param {string} baseUrl CMR environment base URL.
 * @param {number} pageSize Number of results to request.
 * @returns {string} Full search URL.
 */
const buildCollectionsSearchUrl = (baseUrl, pageSize) => {
  const url = new URL('/search/collections.umm_json', baseUrl)
  url.searchParams.set('page_size', String(pageSize))

  return url.toString()
}

/**
 * Fetches one page of collection UMM JSON search results from CMR.
 *
 * @param {object} params Request inputs.
 * @param {string} params.baseUrl CMR environment base URL.
 * @param {number} params.pageSize Number of results to request.
 * @param {string|undefined} params.searchAfter Previous `CMR-Search-After` token.
 * @param {string} params.clientId Client-Id request header.
 * @returns {Promise<{items: object[], searchAfter: string|undefined, hits: number|undefined}>}
 * Page items, the next search-after token, and total hits when available.
 */
const fetchCollectionsPage = async ({
  baseUrl,
  pageSize,
  searchAfter,
  clientId
}) => {
  const url = buildCollectionsSearchUrl(baseUrl, pageSize)
  const headers = {
    'Client-Id': clientId
  }

  if (searchAfter) {
    headers['CMR-Search-After'] = searchAfter
  }

  const response = await fetch(url, {
    headers
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `CMR request failed (${response.status}) for ${url}: ${errorText || response.statusText}`
    )
  }

  const responseBody = await response.json()

  return {
    items: Array.isArray(responseBody?.items) ? responseBody.items : [],
    searchAfter: response.headers.get('CMR-Search-After') || undefined,
    hits: Number(response.headers.get('CMR-Hits') || responseBody?.hits || 0) || undefined
  }
}

/**
 * Filters a page of UMM JSON search results down to concept ids with the requested native format.
 *
 * @param {object[]} items One page of collection search results.
 * @param {string} nativeFormat Exact `item.meta.format` value to match.
 * @returns {string[]} Matching collection concept ids.
 */
const extractMatchingConceptIds = (items, nativeFormat) => items
  .filter((item) => item?.meta?.format === nativeFormat)
  .map((item) => item?.meta?.['concept-id'])
  .filter(Boolean)

/**
 * Crawls every collections page in the target CMR environment and returns matching concept ids.
 *
 * @param {object} params Crawl inputs.
 * @param {string} params.baseUrl CMR environment base URL.
 * @param {string} params.nativeFormat Exact `item.meta.format` value to match.
 * @param {number} params.pageSize Number of items to request per page.
 * @param {number|undefined} params.maxPages Optional page limit for quick verification runs.
 * @param {string} params.clientId Client-Id request header.
 * @returns {Promise<string[]>} Unique matching collection concept ids.
 */
const findCollectionConceptIdsByNativeFormat = async ({
  baseUrl,
  nativeFormat,
  pageSize,
  maxPages,
  clientId
}) => {
  const conceptIds = []
  const seenConceptIds = new Set()
  let pageNumber = 0
  let scannedCollections = 0
  let searchAfter
  let totalHits

  while (true) {
    pageNumber += 1

    const page = await fetchCollectionsPage({
      baseUrl,
      pageSize,
      searchAfter,
      clientId
    })

    const matchingConceptIds = extractMatchingConceptIds(page.items, nativeFormat)

    if (totalHits === undefined) {
      totalHits = page.hits
    }

    scannedCollections += page.items.length

    matchingConceptIds.forEach((conceptId) => {
      if (!seenConceptIds.has(conceptId)) {
        seenConceptIds.add(conceptId)
        conceptIds.push(conceptId)
      }
    })

    console.error(
      `[list-collection-concept-ids-by-native-format] page=${pageNumber} `
      + `items=${page.items.length} scanned=${scannedCollections} matched=${conceptIds.length}`
      + (totalHits ? ` totalHits=${totalHits}` : '')
    )

    if (page.items.length === 0) {
      break
    }

    if (maxPages && pageNumber >= maxPages) {
      break
    }

    if (!page.searchAfter || page.items.length < pageSize) {
      break
    }

    searchAfter = page.searchAfter
  }

  return conceptIds
}

const [, , environmentArg, formatArg] = process.argv

if (environmentArg === '--help' || environmentArg === '-h') {
  showUsageAndExit(0)
}

try {
  const {
    environment,
    baseUrl
  } = resolveEnvironment(environmentArg)
  const {
    formatArg: normalizedFormatArg,
    nativeFormat
  } = resolveNativeFormat(formatArg)
  const pageSize = parsePositiveInteger(process.env.CMR_PAGE_SIZE, 2000)
  const maxPages = process.env.CMR_MAX_PAGES
    ? parsePositiveInteger(process.env.CMR_MAX_PAGES, 1)
    : undefined
  const clientId = process.env.CMR_CLIENT_ID || 'kms-local-script'

  console.error(
    `[list-collection-concept-ids-by-native-format] environment=${environment} `
    + `baseUrl=${baseUrl} format=${normalizedFormatArg} nativeFormat=${nativeFormat} `
    + `pageSize=${pageSize}`
    + (maxPages ? ` maxPages=${maxPages}` : '')
  )

  const conceptIds = await findCollectionConceptIdsByNativeFormat({
    baseUrl,
    nativeFormat,
    pageSize,
    maxPages,
    clientId
  })

  process.stdout.write(`${JSON.stringify(conceptIds, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  showUsageAndExit(1)
}
