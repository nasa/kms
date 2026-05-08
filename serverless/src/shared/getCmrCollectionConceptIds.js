import { cmrPostRequest } from './cmrPostRequest'
import { logger } from './logger'

/**
 * CMR collection fanout lookup for keyword-event processing.
 *
 * This module answers the first question in the metadata-correction pipeline:
 * "given a keyword UUID, which collections in CMR currently reference it?"
 *
 * The keyword-events listener uses this helper to turn one keyword change event into a list of
 * affected collection concept ids, which then become one metadata-correction request per
 * collection. The helper is intentionally limited to the CMR schemes that support UUID-based
 * collection search, and it handles paged CMR UMM results so callers get one deduplicated list
 * back regardless of how many result pages were required.
 */

const CMR_COLLECTION_PAGE_SIZE = 2000

// Build the paged CMR collection search path for the requested result page.
const CMR_COLLECTION_SEARCH_PATH = (pageNumber) => `/search/collections?page_size=${CMR_COLLECTION_PAGE_SIZE}&page_num=${pageNumber}`

const UUID_QUERYABLE_CMR_SCHEMES = {
  sciencekeywords: 'science_keywords',
  platforms: 'platform',
  instruments: 'instrument',
  locations: 'location_keyword',
  providers: 'data_center'
}

// Pull concept ids from the modern CMR UMM results response shape.
const extractConceptIdsFromItems = (items = []) => items
  .map((item) => item?.meta?.['concept-id'])
  .filter(Boolean)

// Dedupe concept ids from the UMM results response shape we explicitly request from CMR.
const extractCollectionConceptIds = (responseBody) => [...new Set(
  extractConceptIdsFromItems(responseBody?.items)
)]

// Build a regular Error from an unsuccessful CMR concept-id lookup response.
const createCmrLookupError = async (response) => {
  const errorText = await response.text()
  const error = new Error(errorText || `HTTP error! status: ${response.status}`)

  error.status = response.status
  error.url = response.url

  return error
}

/**
 * Gets the CMR collection concept ids associated with a keyword UUID.
 *
 * The lookup works by mapping the KMS scheme name to the corresponding CMR search field,
 * issuing a paged UMM-results collection search, and then flattening/deduplicating the returned
 * concept ids across every page.
 *
 * This helper is intentionally limited to the CMR keyword schemes that support UUID-based
 * collection lookup. Schemes that do not support UUID lookup in CMR are rejected here so the
 * caller fails loudly instead of silently returning an incomplete collection set.
 *
 * @param {object} params - The parameters object.
 * @param {string} params.scheme - Keyword scheme from the keyword event.
 * @param {string} params.uuid - Keyword UUID from the keyword event.
 * @returns {Promise<string[]>} Unique CMR collection concept ids.
 * @throws {Error} If the scheme is unsupported, the UUID is missing, or CMR returns a failed response.
 */
export const getCmrCollectionConceptIds = async ({
  scheme,
  uuid
}) => {
  logger.debug('getCmrCollectionConceptIds called with params:', {
    scheme,
    uuid
  })

  const cmrScheme = UUID_QUERYABLE_CMR_SCHEMES[String(scheme).toLowerCase()]

  if (!cmrScheme) {
    throw new Error(`Unsupported CMR concept-id lookup scheme: ${scheme}`)
  }

  if (!uuid) {
    throw new Error('Missing keyword UUID for CMR concept-id lookup')
  }

  const query = {
    condition: {
      [cmrScheme]: {
        uuid
      }
    }
  }

  logger.debug('Using UUID-based query for CMR collection concept ids:', JSON.stringify(query))

  // Request one page of concept ids and keep the raw response for pagination headers.
  const requestPage = async (pageNumber) => {
    const response = await cmrPostRequest({
      path: CMR_COLLECTION_SEARCH_PATH(pageNumber),
      contentType: 'application/json',
      accept: 'application/vnd.nasa.cmr.umm_results+json',
      body: JSON.stringify(query)
    })

    if (!response.ok) {
      throw await createCmrLookupError(response)
    }

    const responseBody = await response.json()

    return {
      response,
      conceptIds: extractCollectionConceptIds(responseBody)
    }
  }

  const firstPage = await requestPage(1)
  const totalHits = Number(firstPage.response.headers?.get?.('cmr-hits')) || firstPage.conceptIds.length
  const totalPages = Math.max(1, Math.ceil(totalHits / CMR_COLLECTION_PAGE_SIZE))
  const remainingPages = totalPages > 1
    ? await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => requestPage(index + 2))
    )
    : []
  const conceptIds = [...new Set([
    ...firstPage.conceptIds,
    ...remainingPages.flatMap((page) => page.conceptIds)
  ])]

  logger.info(
    'Found CMR collection concept ids: '
    + `scheme=${scheme} `
    + `uuid=${uuid} `
    + `count=${conceptIds.length} `
    + `totalHits=${totalHits} `
    + `totalPages=${totalPages}`
  )

  return conceptIds
}

export default getCmrCollectionConceptIds
