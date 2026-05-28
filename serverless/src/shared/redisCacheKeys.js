/**
 * Shared Redis cache-key builders for KMS.
 *
 * This module centralizes the cache namespaces used across KMS so callers do not have to rebuild
 * Redis key formats by hand. It covers two broad categories:
 * - response caches for published API reads such as concepts, concept lists, and trees
 * - lookup caches for metadata-correction workflows, including historical and published concept
 *   lookups by full path, short name, and published UUID
 *
 * Keeping these key builders in one place ensures the publisher, cache-priming jobs, and runtime
 * lookup helpers all agree on the exact Redis key shape.
 */
export const CONCEPT_CACHE_KEY_PREFIX = 'kms:concept'
export const CONCEPTS_CACHE_KEY_PREFIX = 'kms:concepts'
export const TREE_CACHE_KEY_PREFIX = 'kms:tree'
export const CONCEPTS_CACHE_VERSION_KEY = `${CONCEPTS_CACHE_KEY_PREFIX}:published:version`
export const UUID_CACHE_KEY_PREFIX = 'kms:uuid'

// Normalize scheme aliases that share a common cache namespace.
const normalizeConceptsScheme = (scheme) => {
  if (!scheme) return ''

  if (scheme.toLowerCase() === 'granuledataformat') return 'dataformat'

  return scheme
}

const normalizeFormat = (format) => (format || 'rdf').toLowerCase()
const normalizePath = (path) => (path || '').toLowerCase()
const normalizePattern = (pattern) => (pattern || '').toLowerCase()
const normalizeValue = (value) => (value ? encodeURIComponent(value) : '')

/**
 * Builds the published concept-response cache key used for individual concept API responses.
 *
 * @param {object} params - Key parameters.
 * @param {string} [params.version='published'] - Concept version namespace.
 * @param {string} [params.path] - Resource path segment.
 * @param {string} [params.endpointPath] - Endpoint path segment.
 * @param {string} [params.format='rdf'] - Response format segment.
 * @param {string} [params.conceptId] - Concept id segment.
 * @param {string} [params.shortName] - Short-name segment.
 * @param {string} [params.altLabel] - Alt-label segment.
 * @param {string} [params.fullPath] - Full-path segment.
 * @param {string} [params.scheme] - Scheme segment.
 * @returns {string} Redis cache key for a concept response.
 */
export const createConceptResponseCacheKey = ({
  version,
  path,
  endpointPath,
  format,
  conceptId,
  shortName,
  altLabel,
  fullPath,
  scheme
}) => {
  const normalizedVersion = version || 'published'
  const normalizedResourcePath = normalizePath(path)
  const normalizedEndpointPath = normalizePath(endpointPath)
  const normalizedFormat = normalizeFormat(format)
  const normalizedConceptId = normalizeValue(conceptId)
  const normalizedShortName = normalizeValue(shortName)
  const normalizedAltLabel = normalizeValue(altLabel)
  const normalizedFullPath = normalizeValue(fullPath)
  const normalizedScheme = normalizeValue(scheme)

  return `${CONCEPT_CACHE_KEY_PREFIX}:${normalizedVersion}:${normalizedResourcePath}:${normalizedEndpointPath}:${normalizedFormat}:${normalizedConceptId}:${normalizedShortName}:${normalizedAltLabel}:${normalizedFullPath}:${normalizedScheme}`
}

/**
 * Builds the published concepts-list cache key used for list/search style concept responses.
 *
 * @param {object} params - Key parameters.
 * @param {string} [params.version='published'] - Concept version namespace.
 * @param {string} [params.path] - Resource path segment.
 * @param {string} [params.conceptScheme] - Concept scheme segment.
 * @param {string} [params.pattern] - Search/filter pattern segment.
 * @param {string} [params.endpointPath] - Endpoint path segment.
 * @param {string|number} [params.pageNum] - Page number segment.
 * @param {string|number} [params.pageSize] - Page size segment.
 * @param {string} [params.format='rdf'] - Response format segment.
 * @returns {string} Redis cache key for a concepts response.
 */
export const createConceptsResponseCacheKey = ({
  version,
  path,
  conceptScheme,
  pattern,
  endpointPath,
  pageNum,
  pageSize,
  format
}) => {
  const normalizedVersion = version || 'published'
  const normalizedResourcePath = normalizePath(path)
  const normalizedScheme = normalizeConceptsScheme(conceptScheme)
  const normalizedPattern = normalizePattern(pattern)
  const normalizedEndpointPath = normalizePath(endpointPath)
  const normalizedFormat = normalizeFormat(format)

  return `${CONCEPTS_CACHE_KEY_PREFIX}:${normalizedVersion}:${normalizedResourcePath}:${normalizedEndpointPath}:${normalizedScheme}:${normalizedPattern}:${pageNum}:${pageSize}:${normalizedFormat}`
}

/**
 * Builds the published keyword-tree cache key.
 *
 * @param {object} params - Key parameters.
 * @param {string} [params.version='published'] - Concept version namespace.
 * @param {string} [params.conceptScheme] - Concept scheme segment.
 * @param {string} [params.filter] - Tree filter segment.
 * @returns {string} Redis cache key for a tree response.
 */
export const createTreeResponseCacheKey = ({
  version,
  conceptScheme,
  filter
}) => {
  const normalizedVersion = version || 'published'
  const normalizedScheme = normalizeValue((conceptScheme || '').toLowerCase())
  const normalizedFilter = normalizeValue((filter || '').toLowerCase())

  return `${TREE_CACHE_KEY_PREFIX}:${normalizedVersion}:${normalizedScheme}:${normalizedFilter}`
}

/**
 * Builds the historical full-path lookup key used by metadata-correction resolution.
 *
 * @param {object} params - Key parameters.
 * @param {string} params.fullPath - Historical full-path value.
 * @param {string} params.scheme - KMS scheme namespace.
 * @returns {string} Redis cache key for a historical full-path lookup.
 */
export const createConceptResponseCacheKeyByFullPath = ({ fullPath, scheme }) => {
  const normalizedFullPath = normalizeValue(fullPath)
  const normalizedScheme = normalizeValue(normalizeConceptsScheme(scheme).toLowerCase())

  return `kms:${normalizedScheme}:historical_concept:full_path:${normalizedFullPath}`
}

/**
 * Builds the historical short-name lookup key used by metadata-correction resolution.
 *
 * @param {object} params - Key parameters.
 * @param {string} params.shortName - Historical short-name value.
 * @param {string} params.scheme - KMS scheme namespace.
 * @returns {string} Redis cache key for a historical short-name lookup.
 */
export const createConceptResponseCacheKeyByShortName = ({ shortName, scheme }) => {
  const normalizedShortName = normalizeValue(shortName)
  const normalizedScheme = normalizeValue(normalizeConceptsScheme(scheme).toLowerCase())

  return `kms:${normalizedScheme}:historical_concept:short_name:${normalizedShortName}`
}

/**
 * Builds the published full-path lookup key used for current keyword validation.
 *
 * @param {object} params - Key parameters.
 * @param {string} params.fullPath - Published full-path value.
 * @param {string} params.scheme - KMS scheme namespace.
 * @returns {string} Redis cache key for a published full-path lookup.
 */
export const createPublishedConceptResponseCacheKeyByFullPath = ({ fullPath, scheme }) => {
  const normalizedFullPath = normalizeValue(fullPath)
  const normalizedScheme = normalizeValue(normalizeConceptsScheme(scheme).toLowerCase())

  return `kms:${normalizedScheme}:published_concept:full_path:${normalizedFullPath}`
}

/**
 * Builds the published short-name lookup key used for current keyword validation.
 *
 * @param {object} params - Key parameters.
 * @param {string} params.shortName - Published short-name value.
 * @param {string} params.scheme - KMS scheme namespace.
 * @returns {string} Redis cache key for a published short-name lookup.
 */
export const createPublishedConceptResponseCacheKeyByShortName = ({ shortName, scheme }) => {
  const normalizedShortName = normalizeValue(shortName)
  const normalizedScheme = normalizeValue(normalizeConceptsScheme(scheme).toLowerCase())

  return `kms:${normalizedScheme}:published_concept:short_name:${normalizedShortName}`
}

/**
 * Builds the published UUID lookup key used to resolve the current published concept by UUID.
 *
 * @param {object} params - Key parameters.
 * @param {string} params.uuid - Published concept UUID.
 * @param {string} params.scheme - KMS scheme namespace.
 * @returns {string} Redis cache key for a published UUID lookup.
 */
export const createPublishedConceptResponseCacheKeyByUuid = ({ uuid, scheme }) => {
  const normalizedUuid = normalizeValue((uuid || '').toLowerCase())
  const normalizedScheme = normalizeValue(normalizeConceptsScheme(scheme).toLowerCase())

  return `kms:${normalizedScheme}:published_concept:uuid:${normalizedUuid}`
}
