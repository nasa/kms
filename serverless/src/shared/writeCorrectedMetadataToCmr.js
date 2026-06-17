import { cmrPutRequest } from './cmrPutRequest'
import { getCmrWriterToken } from './getCmrWriterToken'
import { logger } from './logger'

/**
 * Serializes corrected metadata into the payload shape expected by CMR ingest.
 *
 * @param {string|Object} correctedMetadata Corrected native metadata payload.
 * @returns {string|undefined} Serialized metadata payload.
 */
const serializeCorrectedMetadata = (correctedMetadata) => (
  typeof correctedMetadata === 'string'
    ? correctedMetadata
    : JSON.stringify(correctedMetadata ?? '')
)

/**
 * Normalizes provider identifiers for rollout gating and comparisons.
 *
 * @param {string} [providerId=''] Provider identifier from CMR metadata.
 * @returns {string} Trimmed upper-cased provider id.
 */
const normalizeProviderId = (providerId) => String(providerId ?? '').trim().toUpperCase()

/**
 * Reads the direct writer-token override from runtime environment variables.
 *
 * @returns {string} Trimmed writer token or an empty string when unset.
 */
const getConfiguredWriterToken = () => String(process.env.CMR_WRITER_TOKEN || '').trim()

/**
 * Parses the rollout allowlist that controls which providers can write back to CMR.
 *
 * @returns {string[]} Normalized provider ids from `CMR_WRITEBACK_PROVIDERS`.
 */
const parseEnabledWritebackProviders = () => String(process.env.CMR_WRITEBACK_PROVIDERS || '')
  .split(',')
  .map((providerId) => normalizeProviderId(providerId))
  .filter(Boolean)

/**
 * True when CMR writeback is enabled for the supplied provider id.
 *
 * @param {string} providerId Provider identifier from collection metadata.
 * @returns {boolean} `true` when writeback is enabled for the provider.
 */
const isWritebackEnabledForProvider = (providerId) => {
  const enabledProviders = parseEnabledWritebackProviders()

  if (enabledProviders.length === 0) {
    return false
  }

  if (enabledProviders.includes('ALL')) {
    return true
  }

  return enabledProviders.includes(normalizeProviderId(providerId))
}

/**
 * True when a direct writer token is configured for auth.
 *
 * @returns {boolean} `true` when writeback auth is configured.
 */
const isWriterTokenConfigured = () => Boolean(getConfiguredWriterToken())

/**
 * Builds the versioned UMM content type expected by CMR ingest.
 *
 * @returns {string} Versioned CMR UMM JSON content type.
 */
const getUmmContentType = () => {
  const ummVersion = String(process.env.CMR_UMM_JSON_VERSION || '1.18.5').trim()

  return `application/vnd.nasa.cmr.umm+json;version=${ummVersion}`
}

/**
 * Maps supported native metadata formats to the corresponding CMR ingest content type.
 *
 * @param {string} nativeFormat Native metadata format identifier.
 * @returns {string} Content type for the ingest request body.
 * @throws {Error} If the native format is not supported for writeback.
 */
const getNativeMetadataContentType = (nativeFormat) => {
  switch (String(nativeFormat).trim().toUpperCase()) {
    case 'UMM':
      return getUmmContentType()
    case 'DIF10':
      return 'application/dif10+xml'
    case 'ECHO10':
      return 'application/echo10+xml'
    case 'ISO19115':
      return 'application/iso19115+xml'
    case 'ISO_SMAP':
      return 'application/iso:smap+xml'
    default:
      throw new Error(`Unsupported native format for CMR writeback: ${nativeFormat}`)
  }
}

/**
 * Safely computes the UTF-8 byte length of the corrected metadata payload.
 *
 * @param {string|Object} correctedMetadata Corrected native metadata payload.
 * @returns {number} UTF-8 byte count, or `0` when serialization fails.
 */
const getCorrectedMetadataByteLength = (correctedMetadata) => {
  try {
    const serializedMetadata = serializeCorrectedMetadata(correctedMetadata)

    return Buffer.byteLength(serializedMetadata, 'utf8')
  } catch {
    return 0
  }
}

/**
 * Parses the text body from a CMR ingest response into JSON when possible.
 *
 * @param {{ text: () => Promise<string> }} response Fetch response wrapper.
 * @returns {Promise<Object|string|null>} Parsed response body, raw text, or `null` when empty.
 */
const parseIngestResponseBody = async (response) => {
  const responseText = await response.text()

  if (!responseText) {
    return null
  }

  try {
    return JSON.parse(responseText)
  } catch {
    return responseText
  }
}

/**
 * Creates a rich error object for non-2xx CMR ingest responses.
 *
 * @param {Object} params Error inputs.
 * @param {Response} params.response Fetch response returned by CMR ingest.
 * @param {string} params.path Request path used for the ingest call.
 * @returns {Promise<Error>} Decorated writeback error with CMR response context attached.
 */
const createWritebackError = async ({
  response,
  path
}) => {
  const responseBody = await parseIngestResponseBody(response)
  let bodyMessage

  if (responseBody === null) {
    bodyMessage = response.statusText
  } else if (typeof responseBody === 'string') {
    bodyMessage = responseBody
  } else {
    bodyMessage = JSON.stringify(responseBody)
  }

  const error = new Error(
    `CMR writeback failed with status ${response.status}: ${bodyMessage}`
  )

  error.status = response.status
  error.statusText = response.statusText
  error.url = response.url
  error.cmrRequest = {
    method: 'PUT',
    path
  }

  error.cmrResponseBody = responseBody

  return error
}

/**
 * Writes corrected native metadata back to CMR through the ingest API.
 *
 * Writeback is rollout-gated by `CMR_WRITEBACK_PROVIDERS`:
 * - unset / empty => disabled
 * - `ALL` => enabled for every provider
 * - comma-separated provider ids => enabled only for those providers
 *
 * Authentication uses a bearer token from `CMR_WRITER_TOKEN`.
 *
 * @param {Object} params Write request details.
 * @param {string} [params.collectionConceptId] Collection concept id being corrected.
 * @param {string} [params.providerId] Collection provider id for CMR ingest routing.
 * @param {string} [params.nativeId] Collection native id for CMR ingest routing.
 * @param {string} [params.nativeFormat] Native metadata format identifier.
 * @param {string|Object} [params.correctedMetadata] Corrected native metadata payload.
 * @param {number} [params.correctionCount] Number of corrections applied to the payload.
 * @param {Array<Object>} [params.correctionsApplied] Applied correction details.
 * @param {string} [params.source] Upstream source label for telemetry.
 * @returns {Promise<Object>} Write summary with ingest result details.
 * @throws {Error} If writeback is enabled for the provider but the payload cannot be written.
 *
 * @example
 * const result = await writeCorrectedMetadataToCmr({
 *   collectionConceptId: 'C0000000000-KMS',
 *   providerId: 'KMS',
 *   nativeId: 'native-1',
 *   nativeFormat: 'DIF10',
 *   correctedMetadata: '<DIF><Entry_ID/></DIF>',
 *   correctionCount: 1,
 *   correctionsApplied: [{ scheme: 'sciencekeywords' }],
 *   source: 'metadataCorrectionService'
 * })
 */
export const writeCorrectedMetadataToCmr = async ({
  collectionConceptId = null,
  providerId = null,
  nativeId = null,
  nativeFormat = null,
  correctedMetadata = '',
  correctionCount = 0,
  correctionsApplied = [],
  source = null
} = {}) => {
  const normalizedCorrectionCount = Number(correctionCount || 0)
  const correctionsAppliedCount = Array.isArray(correctionsApplied) ? correctionsApplied.length : 0
  const correctedMetadataBytes = getCorrectedMetadataByteLength(correctedMetadata)
  const writebackEnabled = isWritebackEnabledForProvider(providerId)
  const writerTokenConfigured = isWriterTokenConfigured()

  if (!writebackEnabled || !writerTokenConfigured) {
    if (writebackEnabled && !writerTokenConfigured) {
      logger.info('[cmr-writeback] Skipping writeback because no writer token is configured', {
        collectionConceptId,
        providerId,
        nativeId,
        nativeFormat
      })
    }

    return {
      targetComponent: 'cmr-writeback',
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctionCount: normalizedCorrectionCount,
      correctionsAppliedCount,
      correctedMetadataBytes,
      source,
      ingestResult: {
        enabled: false,
        ingested: false,
        updated: false
      }
    }
  }

  if (!collectionConceptId || !providerId || !nativeId || !nativeFormat) {
    throw new Error('Incomplete CMR writeback request: missing collectionConceptId/providerId/nativeId/nativeFormat')
  }

  if (normalizedCorrectionCount <= 0) {
    logger.info('[cmr-writeback] Skipping writeback because no corrections were applied', {
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat
    })

    return {
      targetComponent: 'cmr-writeback',
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctionCount: normalizedCorrectionCount,
      correctionsAppliedCount,
      correctedMetadataBytes,
      source,
      ingestResult: {
        enabled: true,
        ingested: false,
        updated: false
      }
    }
  }

  if (correctedMetadata === null || correctedMetadata === undefined || correctedMetadata === '') {
    throw new Error('Missing corrected metadata payload for CMR writeback')
  }

  const serializedMetadata = serializeCorrectedMetadata(correctedMetadata)

  if (!serializedMetadata) {
    throw new Error('Missing corrected metadata payload for CMR writeback')
  }

  const path = `/ingest/providers/${encodeURIComponent(providerId)}/collections/${encodeURIComponent(nativeId)}`
  const contentType = getNativeMetadataContentType(nativeFormat)
  const authorizationToken = await getCmrWriterToken()
  const response = await cmrPutRequest({
    path,
    body: serializedMetadata,
    contentType,
    accept: 'application/json',
    headers: {
      Authorization: `Bearer ${authorizationToken}`
    }
  })

  if (!response.ok) {
    throw await createWritebackError({
      response,
      path
    })
  }

  const responseBody = await parseIngestResponseBody(response)
  const ingestResult = {
    enabled: true,
    ingested: true,
    updated: true,
    status: response.status,
    conceptId: responseBody?.['concept-id'] || null,
    revisionId: responseBody?.['revision-id'] || null,
    responseBody
  }

  logger.info('[cmr-writeback] Wrote corrected metadata to CMR ingest', {
    collectionConceptId,
    providerId,
    nativeId,
    nativeFormat,
    correctionCount: normalizedCorrectionCount,
    revisionId: ingestResult.revisionId
  })

  return {
    targetComponent: 'cmr-writeback',
    collectionConceptId,
    providerId,
    nativeId,
    nativeFormat,
    correctionCount: normalizedCorrectionCount,
    correctionsAppliedCount,
    correctedMetadataBytes,
    source,
    ingestResult
  }
}

export default writeCorrectedMetadataToCmr
