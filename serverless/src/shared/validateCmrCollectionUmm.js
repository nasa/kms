import { cmrPostRequest } from './cmrPostRequest'
import { logger } from './logger'

const CMR_UMM_JSON_CONTENT_TYPE = 'application/vnd.nasa.cmr.umm+json'
const VALIDATION_ERROR_STATUSES = new Set([400, 422])

// Build the CMR ingest validate endpoint path for a collection native id.
const buildValidateCollectionPath = ({
  providerId,
  nativeId
}) => `/ingest/providers/${encodeURIComponent(providerId)}/validate/collection/${encodeURIComponent(nativeId)}`

// Validation errors come back as JSON, but unexpected failures may still be plain text.
const parseResponseBody = async (response) => {
  const responseText = await response.text()

  if (!responseText) {
    return {}
  }

  try {
    return JSON.parse(responseText)
  } catch {
    return {
      raw: responseText
    }
  }
}

// Preserve the raw CMR validation failure payload on unexpected non-400 errors.
const createValidationError = ({
  response,
  responseBody
}) => {
  const message = responseBody?.raw || `HTTP error! status: ${response.status}`
  const error = new Error(message)

  error.status = response.status
  error.url = response.url
  error.responseBody = responseBody

  return error
}

/**
 * Validates a collection's UMM-C against CMR ingest validation.
 *
 * KMS-675 uses this to surface keyword validation failures from CMR without attempting to
 * update the metadata yet. A 400/422 response is expected when validation errors are present,
 * so those statuses are returned as part of the normal helper result instead of being thrown.
 *
 * @param {object} params - Validation parameters.
 * @param {string} params.providerId - Collection provider id.
 * @param {string} params.nativeId - Collection native id.
 * @param {Record<string, unknown>} params.umm - Collection UMM-C payload.
 * @returns {Promise<{status: number, errors: Array, warnings: Array, responseBody: Record<string, unknown>}>}
 * Validation results from CMR.
 */
export const validateCmrCollectionUmm = async ({
  providerId,
  nativeId,
  umm
}) => {
  if (!providerId) {
    throw new Error('Missing provider id for CMR collection validation')
  }

  if (!nativeId) {
    throw new Error('Missing native id for CMR collection validation')
  }

  if (!umm) {
    throw new Error('Missing UMM-C payload for CMR collection validation')
  }

  const response = await cmrPostRequest({
    path: buildValidateCollectionPath({
      providerId,
      nativeId
    }),
    body: JSON.stringify(umm),
    contentType: CMR_UMM_JSON_CONTENT_TYPE,
    accept: 'application/json',
    headers: {
      'Cmr-Validate-Keywords': 'true'
    }
  })
  const responseBody = await parseResponseBody(response)

  if (!response.ok && !VALIDATION_ERROR_STATUSES.has(response.status)) {
    throw createValidationError({
      response,
      responseBody
    })
  }

  const validationResult = {
    status: response.status,
    errors: Array.isArray(responseBody?.errors) ? responseBody.errors : [],
    warnings: Array.isArray(responseBody?.warnings) ? responseBody.warnings : [],
    responseBody
  }

  logger.info(
    '[metadata-correction] Validated collection UMM through CMR '
    + `providerId=${providerId} `
    + `nativeId=${nativeId} `
    + `status=${validationResult.status} `
    + `errorCount=${validationResult.errors.length} `
    + `warningCount=${validationResult.warnings.length}`
  )

  return validationResult
}

export default validateCmrCollectionUmm
