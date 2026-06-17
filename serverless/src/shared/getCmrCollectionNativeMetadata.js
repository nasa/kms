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
 * Shapes a native-metadata fetch result when callers need both the payload and response metadata.
 *
 * @param {Object} params Response metadata inputs.
 * @param {string|Record<string, unknown>} params.metadataPayload Parsed or raw native metadata.
 * @param {string} params.contentType Exact response content type returned by CMR.
 * @returns {{metadataPayload: string|Record<string, unknown>, contentType: string}} Native payload
 * plus the original response content type.
 */
const buildNativeMetadataResponse = ({
  metadataPayload,
  contentType
}) => ({
  metadataPayload,
  contentType
})

/**
 * Fetches the collection's raw native metadata payload from CMR.
 *
 * This helper uses CMR's explicit `.native` concept endpoint so the returned payload is the
 * collection's stored native metadata format rather than a search response wrapper.
 *
 * @param {object} params - Native metadata lookup parameters.
 * @param {string} params.collectionConceptId - Collection concept id to fetch.
 * @param {number} [params.revisionId] - Optional revision id for a stable concept revision fetch.
 * @param {boolean} [params.includeResponseMetadata=false] - When `true`, return the native payload
 * plus the exact CMR response content type so callers can preserve versioned media types.
 * JSON-native formats such as UMM are parsed into objects so downstream delegates can mutate the
 * in-memory payload directly. Text/XML native formats are returned as raw strings.
 *
 * @returns {Promise<string|Record<string, unknown>|{
 *   metadataPayload: string|Record<string, unknown>,
 *   contentType: string
 * }>} Raw or parsed native metadata payload, optionally with response metadata.
 * @throws {Error} If the concept id is missing, CMR returns a failed response, or the response
 * body is empty.
 */
export const getCmrCollectionNativeMetadata = async ({
  collectionConceptId,
  revisionId,
  includeResponseMetadata = false
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

  const metadataPayloadText = await response.text()

  if (!metadataPayloadText) {
    throw new Error(`Empty CMR native metadata response for collection concept id: ${collectionConceptId}`)
  }

  const contentType = String(response.headers?.get?.('content-type') || '')
  const normalizedContentType = contentType.toLowerCase()
  let metadataPayload = metadataPayloadText

  if (normalizedContentType.includes('json')) {
    try {
      metadataPayload = JSON.parse(metadataPayloadText)
    } catch {
      metadataPayload = metadataPayloadText
    }
  }

  logger.info(
    '[metadata-correction] Fetched CMR native metadata payload '
    + `collectionConceptId=${collectionConceptId} `
    + `revisionId=${revisionId ?? 'latest'} `
    + `payloadBytes=${Buffer.byteLength(metadataPayloadText, 'utf8')}`
  )

  if (includeResponseMetadata) {
    return buildNativeMetadataResponse({
      metadataPayload,
      contentType
    })
  }

  return metadataPayload
}

export default getCmrCollectionNativeMetadata
