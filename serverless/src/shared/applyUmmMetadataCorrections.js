/**
 * UMM-C correction delegate used by the KMS-675 smoke flow.
 *
 * This module is intentionally narrower than a real production ingest/mutation layer. Its job is
 * to take already-resolved metadata corrections and apply them directly to an in-memory UMM-C
 * payload so local end-to-end tests can prove the correction pipeline works from event intake
 * through audit/writeback.
 *
 * In other words, this is still a stub for the broader native-format story, but it is a useful
 * stub: it knows just enough UMM-C structure to rewrite supported keyword shapes and remove
 * delete-targets during the smoke test.
 */
const SHORT_NAME_SCHEMES = new Set([
  'platforms',
  'instruments',
  'projects',
  'providers',
  'idnnode'
])

const FULL_PATH_OBJECT_FIELD_MAPS = {
  sciencekeywords: [
    'Category',
    'Topic',
    'Term',
    'VariableLevel1',
    'VariableLevel2',
    'VariableLevel3',
    'DetailedVariable'
  ].map((fieldName) => ({
    pathKey: fieldName,
    ummField: fieldName
  })),
  locations: [
    'Category',
    'Type',
    'Subregion1',
    'Subregion2',
    'Subregion3',
    'DetailedLocation'
  ].map((fieldName) => ({
    pathKey: fieldName,
    ummField: fieldName
  })),
  rucontenttype: [
    'URLContentType',
    'Type',
    'Subtype'
  ].map((fieldName) => ({
    pathKey: fieldName,
    ummField: fieldName
  })),
  chronounits: [
    {
      pathKey: 'Eon',
      ummField: 'Eon'
    },
    {
      pathKey: 'Era',
      ummField: 'Era'
    },
    {
      pathKey: 'Period',
      ummField: 'Period'
    },
    {
      pathKey: 'Epoch',
      ummField: 'Epoch'
    },
    {
      pathKey: 'Age',
      ummField: 'Stage'
    },
    {
      pathKey: 'SubAge',
      ummField: 'DetailedClassification'
    }
  ]
}

// Clone the payload so the delegate can return a mutated copy without touching caller input.
const cloneMetadata = (metadataPayload) => (
  metadataPayload ? structuredClone(metadataPayload) : metadataPayload
)

// Walks a UMM validation path such as ['Platforms', 0, 'Instruments', 0] and returns
// the keyword object currently sitting at that location.
const getTargetAtPath = (source, path) => (path || []).reduce(
  (currentValue, segment) => currentValue?.[segment],
  source
)

// Same as getTargetAtPath, but stops one segment early so delete operations can mutate
// the containing array/object rather than the leaf value itself.
const getParentAtPath = (source, path) => {
  const keywordPath = path || []

  /* istanbul ignore next -- callers validate delete paths before this helper is reached */
  if (!Array.isArray(keywordPath) || keywordPath.length === 0) {
    return undefined
  }

  return keywordPath.slice(0, -1).reduce(
    (currentValue, segment) => currentValue?.[segment],
    source
  )
}

// Object-backed full-path schemes are written by mapping canonical path keys back into the
// specific UMM field names used by that scheme.
const applyFullPathObjectCorrection = ({
  targetKeyword,
  normalizedScheme,
  newKeywordObject
}) => {
  if (!targetKeyword || typeof targetKeyword !== 'object') {
    return false
  }

  const fieldMap = FULL_PATH_OBJECT_FIELD_MAPS[normalizedScheme]

  const keyword = targetKeyword
  const keywordObject = newKeywordObject

  fieldMap.forEach(({
    pathKey,
    ummField
  }) => {
    const nextValue = keywordObject[pathKey]

    if (nextValue) {
      keyword[ummField] = nextValue
    } else {
      delete keyword[ummField]
    }
  })

  return true
}

// Short-name schemes keep the resolved concept in the last path segment, so replacing the
// keyword is as simple as swapping the UMM ShortName to the leaf value from KMS.
const applyShortNameCorrection = (targetKeyword, newKeywordObject) => {
  if (!targetKeyword || typeof targetKeyword !== 'object') {
    return false
  }

  const keyword = targetKeyword
  const nextShortName = newKeywordObject?.ShortName

  if (!nextShortName) {
    return false
  }

  keyword.ShortName = nextShortName

  return true
}

// Delete corrections do not have a replacement path. Instead, we remove the keyword from the
// collection at the exact UMM validation path that failed validation.
const removeKeywordAtPath = (source, path) => {
  const keywordPath = path || []

  if (!Array.isArray(keywordPath) || keywordPath.length === 0) {
    return false
  }

  const parent = getParentAtPath(source, keywordPath)
  const lastSegment = keywordPath.at(-1)

  if (Array.isArray(parent) && Number.isInteger(lastSegment)) {
    if (lastSegment < 0 || lastSegment >= parent.length) {
      return false
    }

    parent.splice(lastSegment, 1)

    return true
  }

  if (parent && typeof parent === 'object' && typeof lastSegment === 'string') {
    if (!(lastSegment in parent)) {
      return false
    }

    delete parent[lastSegment]

    return true
  }

  return false
}

/**
 * Local-first UMM delegate for KMS-675.
 *
 * This still acts like a stub for broader native-format work, but it now applies the resolved
 * keyword replacements directly to the UMM-C payload shape so local end-to-end tests can persist
 * corrected metadata into the mock CMR server.
 */
export const applyUmmMetadataCorrections = async ({
  collectionConceptId,
  providerId,
  nativeId,
  metadataPayload,
  corrections = []
}) => {
  // We mutate a deep clone so the delegate result can be inspected or persisted without
  // altering the original CMR response object that came into the service.
  const correctedMetadata = cloneMetadata(metadataPayload)
  const correctionsApplied = []

  corrections.forEach((correction) => {
    const normalizedAction = String(correction.action || 'replace').toLowerCase()
    const normalizedScheme = String(correction.scheme).toLowerCase()
    let didApply = false

    if (normalizedAction === 'delete') {
      // For delete events, the resolver already proved the metadata keyword matches the
      // deleted concept UUID. All we need to do here is remove that exact keyword node.
      didApply = removeKeywordAtPath(correctedMetadata, correction.ummPath)
    } else {
      // For replace-style updates, we first locate the failing keyword in the UMM payload
      // and then rewrite it according to the scheme-specific shape.
      const targetKeyword = getTargetAtPath(correctedMetadata, correction.ummPath)

      if (!targetKeyword) {
        return
      }

      if (FULL_PATH_OBJECT_FIELD_MAPS[normalizedScheme]) {
        didApply = applyFullPathObjectCorrection({
          targetKeyword,
          normalizedScheme,
          newKeywordObject: correction.newKeywordObject
        })
      } else if (SHORT_NAME_SCHEMES.has(normalizedScheme)) {
        didApply = applyShortNameCorrection(targetKeyword, correction.newKeywordObject)
      }
    }

    if (didApply) {
      // We keep the original correction descriptor so the caller can audit exactly which
      // resolved corrections were actually applied to this metadata payload.
      correctionsApplied.push(correction)
    }
  })

  return {
    nativeFormat: 'UMM',
    delegateName: 'umm',
    collectionConceptId,
    providerId,
    nativeId,
    correctionCount: correctionsApplied.length,
    correctedMetadata,
    correctionsApplied,
    stubbed: true
  }
}

export default applyUmmMetadataCorrections
