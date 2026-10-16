/**
 * Shared rollout-allowlist helpers for the CMR metadata-correction "fixer" service.
 *
 * `CMR_WRITEBACK_PROVIDERS` controls both which providers KMS will write corrected metadata
 * back to CMR for, and (earlier in the pipeline) which providers are even worth building a fix
 * for. Keeping the parsing/matching rules here means every call site agrees on the same
 * semantics: unset/empty disables everything, `ALL` enables every provider, otherwise only the
 * listed provider ids are enabled.
 */

/**
 * Normalizes provider identifiers for rollout gating and comparisons.
 *
 * @param {string} [providerId=''] Provider identifier.
 * @returns {string} Trimmed upper-cased provider id.
 */
export const normalizeProviderId = (providerId) => String(providerId ?? '').trim().toUpperCase()

/**
 * Parses the rollout allowlist that controls which providers the fixer service is enabled for.
 *
 * @returns {string[]} Normalized provider ids from `CMR_WRITEBACK_PROVIDERS`.
 */
export const parseEnabledWritebackProviders = () => String(process.env.CMR_WRITEBACK_PROVIDERS || '')
  .split(',')
  .map((providerId) => normalizeProviderId(providerId))
  .filter(Boolean)

/**
 * True when the fixer service is enabled for the supplied provider id.
 *
 * @param {string} providerId Provider identifier to check against the rollout allowlist.
 * @returns {boolean} `true` when the fixer service is enabled for the provider.
 */
export const isWritebackEnabledForProvider = (providerId) => {
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
 * Extracts the provider id from a CMR collection concept id (`C1200370045-ARCTEST`).
 *
 * @param {string} collectionConceptId CMR collection concept id.
 * @returns {string} Provider id, or an empty string when it cannot be determined.
 */
export const getProviderIdFromCollectionConceptId = (collectionConceptId) => {
  const value = String(collectionConceptId ?? '')
  const separatorIndex = value.indexOf('-')

  return separatorIndex === -1 ? '' : value.slice(separatorIndex + 1)
}

/**
 * Splits collection concept ids into those whose provider is enabled for the fixer service and
 * those that should be dropped before any correction work is queued for them.
 *
 * Both the asynchronous correction API and the keyword-event listener fan out one queued
 * correction request per collection concept id. Filtering here, before either ever publishes a
 * request, means we never fetch collection metadata or build a fix for a provider we were always
 * going to discard the result for.
 *
 * @param {string[]} collectionConceptIds Collection concept ids to filter.
 * @param {Function} [onSkip] Optional callback invoked once per skipped entry
 * (`{ collectionConceptId, providerId }`), e.g. to log it.
 * @returns {{
 *   eligibleCollectionConceptIds: string[],
 *   skipped: Array<{ collectionConceptId: string, providerId: string }>
 * }} Concept ids eligible to queue and the ones skipped for a disabled provider.
 */
export const filterEnabledProviderCollectionConceptIds = (collectionConceptIds, onSkip) => {
  const eligibleCollectionConceptIds = []
  const skipped = []

  collectionConceptIds.forEach((collectionConceptId) => {
    const providerId = getProviderIdFromCollectionConceptId(collectionConceptId)

    if (isWritebackEnabledForProvider(providerId)) {
      eligibleCollectionConceptIds.push(collectionConceptId)

      return
    }

    const skippedEntry = {
      collectionConceptId,
      providerId
    }

    skipped.push(skippedEntry)
    onSkip?.(skippedEntry)
  })

  return {
    eligibleCollectionConceptIds,
    skipped
  }
}
