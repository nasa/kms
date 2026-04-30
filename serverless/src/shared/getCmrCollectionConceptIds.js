import { cmrPostRequest } from './cmrPostRequest'
import { logger } from './logger'

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
 * This helper is intentionally limited to the CMR keyword schemes that support UUID-based
 * collection lookup. Schemes that do not support UUID lookup in CMR are not handled here.
 *
 * @param {object} params - The parameters object.
 * @param {string} params.scheme - Keyword scheme from the keyword event.
 * @param {string} params.uuid - Keyword UUID from the keyword event.
 * @returns {Promise<string[]>} Unique CMR collection concept ids.
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
