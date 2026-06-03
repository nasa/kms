import { cmrGetRequest } from './cmrGetRequest'
import { formatKeywordObjectForLog } from './formatKeywordObjectForLog'
import { logger } from './logger'

/**
 * CMR collection fanout lookup for keyword-event processing.
 *
 * This module answers the first question in the metadata-correction pipeline:
 * "given a keyword UUID, which collections in CMR currently reference it?"
 *
 * The keyword-events listener uses this helper to turn one keyword change event into a list of
 * affected collection concept ids, which then become one metadata-correction request per
 * collection. The lookup now goes directly through the public CMR keyword search parameter,
 * and it handles paged UMM JSON results so callers get one deduplicated list back regardless
 * of how many result pages were required.
 */

const CMR_COLLECTION_PAGE_SIZE = 2000

// Build the paged CMR collection search path for the requested result page.
const CMR_COLLECTION_SEARCH_PATH = (uuid, pageNumber) => `/search/collections.umm_json?keyword=${encodeURIComponent(uuid)}&page_size=${CMR_COLLECTION_PAGE_SIZE}&page_num=${pageNumber}`

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
 * The lookup works by issuing a paged CMR collection search keyed directly by the keyword UUID,
 * then flattening/deduplicating the returned concept ids across every page.
 *
 * @param {object} params - The parameters object.
 * @param {string} [params.scheme] - Keyword scheme from the keyword event. This is kept for
 *   logging and caller compatibility, but the CMR lookup itself is now UUID-driven.
 * @param {string} params.uuid - Keyword UUID from the keyword event.
 * @param {Record<string, unknown>} [params.keywordObject] - Human-readable keyword object from
 *   the event, logged to make CloudWatch fanout lookups easier to trace.
 * @returns {Promise<string[]>} Unique CMR collection concept ids.
 * @throws {Error} If the UUID is missing or CMR returns a failed response.
 */
export const getCmrCollectionConceptIds = async ({
  scheme,
  uuid,
  keywordObject
}) => {
  logger.debug('getCmrCollectionConceptIds called with params:', {
    scheme,
    uuid,
    keywordObject
  })

  if (!uuid) {
    throw new Error('Missing keyword UUID for CMR concept-id lookup')
  }

  logger.debug('Using keyword UUID GET lookup for CMR collection concept ids:', {
    scheme,
    uuid,
    keywordObject
  })

  // Request one page of concept ids and keep the raw response for pagination headers.
  const requestPage = async (pageNumber) => {
    const response = await cmrGetRequest({
      path: CMR_COLLECTION_SEARCH_PATH(uuid, pageNumber)
    })

    if (!response.ok) {
      throw await createCmrLookupError(response)
    }

    const responseBody = await response.json()

    return {
      response,
      responseBody,
      conceptIds: extractCollectionConceptIds(responseBody)
    }
  }

  const firstPage = await requestPage(1)
  const totalHits = Number(firstPage.responseBody?.hits)
    || Number(firstPage.response.headers?.get?.('cmr-hits'))
    || firstPage.conceptIds.length
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
    + `keywordObject=${formatKeywordObjectForLog(keywordObject)} `
    + `count=${conceptIds.length} `
    + `totalHits=${totalHits} `
    + `totalPages=${totalPages}`
  )

  return conceptIds
}

export default getCmrCollectionConceptIds
