import { cmrGetRequest } from './cmrGetRequest'
import { logger } from './logger'

/**
 * CMR collection metadata fetch helper for collection-scoped correction work.
 *
 * Once the keyword-events listener has identified an affected collection concept id, the
 * metadata-correction service uses this helper to fetch the current collection UMM plus the
 * specific CMR identifiers the rest of the pipeline needs: concept id, provider id, native id,
 * and revision id. In practice this is the "load the collection we are about to validate and
 * correct" step.
 *
 * The helper uses the CMR UMM-results search response shape because it gives us the collection
 * UMM payload and the native/provider identifiers in one request, which is exactly what the
 * correction service needs for validation, delegate routing, audit logging, and the later ingest
 * seam.
 */

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
 * The returned object is intentionally shaped for the metadata-correction flow, which needs:
 * - the concept id for logging/audit continuity
 * - the provider/native ids for writeback-related seams
 * - the format to choose the correct delegate
 * - the current UMM payload for validation and correction
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
 * @throws {Error} If the concept id is missing, CMR returns a failed response, or the response
 * is missing required UMM/native/provider fields.
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
