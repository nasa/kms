import { cmrGetRequest } from './cmrGetRequest'
import { logger } from './logger'

const CMR_COLLECTION_UMM_RESULTS_ACCEPT = 'application/vnd.nasa.cmr.umm_results+json'

// Build the single-result collection search path for a concept-id lookup.
const buildCollectionSearchPath = (collectionConceptId) => `/search/collections?concept_id=${encodeURIComponent(collectionConceptId)}&page_size=1`

// Normalize unsuccessful CMR search responses into a regular Error with request context.
const createCollectionMetadataError = async (response) => {
  const errorText = await response.text()
  const error = new Error(errorText || `HTTP error! status: ${response.status}`)

  error.status = response.status
  error.url = response.url

  return error
}

/**
 * Fetches the UMM-C and related CMR metadata for a collection concept id.
 *
 * This uses CMR search UMM results instead of the raw concept endpoint so we can retrieve
 * the collection UMM-C and the native id/provider id needed for later validate/update calls
 * in a single request.
 *
 * @param {object} params - Helper parameters.
 * @param {string} params.collectionConceptId - Collection concept id to fetch.
 * @returns {Promise<{
 *   collectionConceptId: string,
 *   nativeId: string,
 *   providerId: string,
 *   format: string | undefined,
 *   revisionId: number | undefined,
 *   umm: Record<string, unknown>
 * }>} CMR collection details for correction work.
 */
export const getCmrCollectionUmmDetails = async ({
  collectionConceptId
}) => {
  if (!collectionConceptId) {
    throw new Error('Missing collection concept id for CMR UMM lookup')
  }

  const response = await cmrGetRequest({
    path: buildCollectionSearchPath(collectionConceptId),
    accept: CMR_COLLECTION_UMM_RESULTS_ACCEPT
  })

  if (!response.ok) {
    throw await createCollectionMetadataError(response)
  }

  const responseBody = await response.json()
  const [item] = responseBody?.items || []
  const meta = item?.meta || {}
  const umm = item?.umm
  const nativeId = meta['native-id']
  const providerId = meta['provider-id']

  if (!umm || !nativeId || !providerId) {
    throw new Error(`Incomplete CMR UMM lookup response for collection concept id: ${collectionConceptId}`)
  }

  const details = {
    collectionConceptId: meta['concept-id'] || collectionConceptId,
    nativeId,
    providerId,
    format: meta.format,
    revisionId: meta['revision-id'],
    umm
  }

  logger.info(
    '[metadata-correction] Fetched CMR collection UMM details '
    + `collectionConceptId=${details.collectionConceptId} `
    + `providerId=${details.providerId} `
    + `nativeId=${details.nativeId} `
    + `format=${details.format} `
    + `revisionId=${details.revisionId}`
  )

  return details
}

export default getCmrCollectionUmmDetails
