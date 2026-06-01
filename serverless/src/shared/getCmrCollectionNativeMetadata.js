import { cmrGetRequest } from './cmrGetRequest'
import { logger } from './logger'

// Build the raw concept-retrieval path for a collection concept id, optionally pinned to a revision.
const buildCollectionConceptPath = ({
  collectionConceptId,
  revisionId
}) => (
  revisionId === undefined || revisionId === null
    ? `/search/concepts/${encodeURIComponent(collectionConceptId)}.native`
    : `/search/concepts/${encodeURIComponent(collectionConceptId)}/${encodeURIComponent(String(revisionId))}.native`
)

// Normalize unsuccessful raw concept responses into an Error that keeps HTTP request context.
const createCollectionNativeMetadataError = async (response) => {
  const errorText = await response.text()
  const error = new Error(errorText || `HTTP error! status: ${response.status}`)

  error.status = response.status
  error.url = response.url

  return error
}

/**
 * Fetches the collection's raw native metadata payload from CMR.
 *
 * This helper uses CMR's explicit `.native` concept endpoint so the returned payload is the
 * collection's stored native metadata format rather than a search response wrapper.
 *
 * @param {object} params - Native metadata lookup parameters.
 * @param {string} params.collectionConceptId - Collection concept id to fetch.
 * @param {number} [params.revisionId] - Optional revision id for a stable concept revision fetch.
 * @returns {Promise<string>} Raw native metadata payload.
 * @throws {Error} If the concept id is missing, CMR returns a failed response, or the response
 * body is empty.
 */
export const getCmrCollectionNativeMetadata = async ({
  collectionConceptId,
  revisionId
}) => {
  if (!collectionConceptId) {
    throw new Error('Missing collection concept id for CMR native metadata lookup')
  }

  const response = await cmrGetRequest({
    path: buildCollectionConceptPath({
      collectionConceptId,
      revisionId
    })
  })

  if (!response.ok) {
    throw await createCollectionNativeMetadataError(response)
  }

  const metadataPayload = await response.text()

  if (!metadataPayload) {
    throw new Error(`Empty CMR native metadata response for collection concept id: ${collectionConceptId}`)
  }

  logger.info(
    '[metadata-correction] Fetched CMR native metadata payload '
    + `collectionConceptId=${collectionConceptId} `
    + `revisionId=${revisionId ?? 'latest'} `
    + `payloadBytes=${Buffer.byteLength(metadataPayload, 'utf8')}`
  )

  return metadataPayload
}

export default getCmrCollectionNativeMetadata
