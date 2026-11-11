import { getCmrSystemToken } from './getCmrWriterToken'
import { logger } from './logger'

// These are CMR's refresh API names, not the KMS CSV resource names.
const CMR_SCHEMES = Object.freeze({
  providers: 'providers',
  platforms: 'platforms',
  instruments: 'instruments',
  projects: 'projects',
  temporalresolutionrange: 'temporal_keywords',
  locations: 'spatial_keywords',
  sciencekeywords: 'science_keywords',
  measurementname: 'measurement_name',
  idnnode: 'concepts',
  isotopiccategory: 'iso_topic_categories',
  rucontenttype: 'related_urls',
  dataformat: 'granule_data_format',
  mimetype: 'mime_type',
  productlevelid: 'processing_levels'
})
const AUDIT_TIME_RESERVE_MS = 30_000

/**
 * Selects each changed, CMR-cached scheme once, including insertions and deletions.
 * KMS schemes that CMR does not cache must not trigger an accidental full refresh.
 *
 * @param {Object[]} keywordEvents Generated keyword events for the publish.
 * @returns {string[]} Sorted, unique CMR refresh scheme names.
 */
export const getChangedCmrSchemes = (keywordEvents = []) => [...new Set(
  keywordEvents.map(({ Scheme }) => CMR_SCHEMES[String(Scheme || '').trim().toLowerCase()])
    .filter((scheme) => typeof scheme === 'string')
)].sort()

/**
 * Refreshes CMR synchronously after publication and before correction events are released.
 * A failed/uncertain refresh must never fall back to bypassing CMR keyword validation.
 *
 * @param {Object} params Refresh inputs.
 * @param {Object[]} params.keywordEvents Generated keyword events.
 * @param {number} [params.remainingTimeMs] Remaining publisher Lambda execution time.
 * @returns {Promise<{schemes: string[], refreshed: boolean}>} Confirmed refresh or no-op.
 */
export const refreshCmrKeywordSchemes = async ({ keywordEvents = [], remainingTimeMs } = {}) => {
  const schemes = getChangedCmrSchemes(keywordEvents)
  if (!schemes.length) {
    return {
      schemes,
      refreshed: false
    }
  }

  let timeoutMs = 120_000
  if (Number.isFinite(remainingTimeMs)) {
    timeoutMs = Math.min(timeoutMs, remainingTimeMs - AUDIT_TIME_RESERVE_MS)
  }

  const configuredBase = String(process.env.CMR_BASE_URL || '').trim()
  if (!configuredBase) throw new Error('CMR_BASE_URL is required for keyword refresh')
  if (timeoutMs <= 0) throw new Error('Insufficient publisher time remaining to refresh CMR and audit failures')

  const url = new URL(`${configuredBase.replace(/\/+$/, '')}/bootstrap/caches/refresh/kms`)
  url.searchParams.set('concept_scheme', schemes.join(','))
  const startedAt = Date.now()
  const controller = new AbortController()
  // Abort before Lambda termination so the catch path can record the failure audit.
  const timeoutId = setTimeout(() => controller.abort(
    new Error(`CMR keyword refresh timeout after ${timeoutMs}ms; refresh completion is unknown`)
  ), timeoutMs)

  try {
    const token = await getCmrSystemToken()
    if (!token) throw new Error('CMR system token is required for keyword cache refresh')
    controller.signal.throwIfAborted()
    logger.info('[publisher] Refreshing CMR keyword schemes', {
      schemes,
      url: url.toString(),
      timeoutMs
    })

    // One POST only: retrying is an operator decision, especially after an uncertain timeout.
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: token,
        'Client-Id': 'kms-publisher',
        Accept: 'application/json'
      },
      signal: controller.signal,
      redirect: 'error'
    })
    // Keep the deadline active through body consumption, not just receipt of response headers.
    const body = await response.text()
    if (response.status !== 200) {
      const error = new Error(`CMR keyword refresh failed with status ${response.status}: ${body.slice(0, 2000)}`)
      error.status = response.status
      error.statusText = response.statusText
      error.cmrResponseBody = body
      throw error
    }

    logger.info('[publisher] CMR keyword refresh completed', {
      schemes,
      durationMs: Date.now() - startedAt,
      requestId: response.headers?.get?.('cmr-request-id')
    })

    return {
      schemes,
      refreshed: true
    }
  } catch (error) {
    const failure = controller.signal.aborted ? controller.signal.reason : error
    failure.url = url.toString()
    failure.cmrRequest = {
      method: 'POST',
      path: `${url.pathname}${url.search}`,
      schemes,
      timeoutMs,
      durationMs: Date.now() - startedAt,
      timedOut: controller.signal.aborted
    }

    throw failure
  } finally {
    clearTimeout(timeoutId)
  }
}
