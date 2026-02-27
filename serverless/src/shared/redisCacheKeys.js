export const CONCEPT_CACHE_KEY_PREFIX = 'kms:concept'
export const CONCEPTS_CACHE_KEY_PREFIX = 'kms:concepts'
export const TREE_CACHE_KEY_PREFIX = 'kms:tree'
export const CONCEPTS_CACHE_VERSION_KEY = `${CONCEPTS_CACHE_KEY_PREFIX}:published:version`

const normalizeConceptsScheme = (scheme) => {
  if (!scheme) return ''

  if (scheme.toLowerCase() === 'granuledataformat') return 'dataformat'

  return scheme
}

const normalizeFormat = (format) => (format || 'rdf').toLowerCase()
const normalizePath = (path) => (path || '').toLowerCase()
const normalizePattern = (pattern) => (pattern || '').toLowerCase()
const normalizeValue = (value) => (value ? encodeURIComponent(value) : '')

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
