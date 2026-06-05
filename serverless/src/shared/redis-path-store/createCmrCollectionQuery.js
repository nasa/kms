const getCmrCollectionSchemeName = (scheme) => {
  switch (String(scheme || '').toLowerCase()) {
    case 'sciencekeywords':
      return 'science_keywords'
    case 'platforms':
      return 'platform'
    case 'instruments':
      return 'instrument'
    case 'locations':
      return 'location_keyword'
    case 'projects':
      return 'project'
    case 'providers':
      return 'data_center'
    case 'productlevelid':
      return 'processing_level_id'
    case 'dataformat':
    case 'granuledataformat':
      return 'granule_data_format'
    default:
      return scheme
  }
}

const getCmrProviderHierarchySegments = ({
  fullPath,
  isLeaf
}) => {
  const segments = String(fullPath || '')
    .split('|')
    .map((segment) => segment.trim())

  if (!isLeaf) {
    return segments
  }

  return segments.length > 1 ? segments.slice(0, -1) : segments
}

const buildCmrHierarchyCondition = ({
  hierarchyFields,
  keywordList,
  prefLabelField,
  prefLabelParam
}) => {
  const condition = {}

  for (let index = 0; index < Math.min(hierarchyFields.length, keywordList.length); index += 1) {
    const fieldName = hierarchyFields[index]
    const fieldValue = keywordList[index]

    if (fieldValue != null && fieldValue !== '') {
      condition[fieldName] = fieldValue
    }
  }

  if (prefLabelField != null && prefLabelParam != null) {
    condition[prefLabelField] = prefLabelParam
  }

  condition.ignore_case = false

  return condition
}

/**
 * Builds the CMR collection-search request shape for a KMS keyword.
 *
 * The returned object is intentionally transport-ready enough for the caller to decide whether to
 * issue a `GET` query-string request or a `POST` body-based request.
 *
 * @param {object} params - Keyword lookup inputs.
 * @param {string} params.scheme - KMS keyword scheme such as `sciencekeywords` or `providers`.
 * @param {string} [params.uuid] - Keyword uuid for uuid-backed CMR schemes.
 * @param {string} [params.prefLabel] - Preferred label or short name for prefLabel/query-string schemes.
 * @param {string} [params.fullPath] - Provider full path used to build hierarchy queries.
 * @param {boolean} [params.isLeaf] - Whether the keyword represents a leaf provider node.
 * @returns {{
 *   cmrScheme: string,
 *   method: 'GET'|'POST',
 *   queryType: 'uuid'|'prefLabel'|'hierarchy'|'queryString',
 *   query: object|string
 * }} CMR request descriptor.
 * @throws {never} This helper normalizes input and always returns a query descriptor.
 *
 * @example
 * // Request
 * const request = createCmrCollectionQuery({
 *   scheme: 'providers',
 *   fullPath: 'NASA|GSFC|EOSDIS|GHRC',
 *   prefLabel: 'GHRC',
 *   isLeaf: true
 * })
 *
 * // Response
 * // {
 * //   cmrScheme: 'data_center',
 * //   method: 'POST',
 * //   queryType: 'hierarchy',
 * //   query: {
 * //     condition: {
 * //       data_center: {
 * //         level_0: 'NASA',
 * //         level_1: 'GSFC',
 * //         level_2: 'EOSDIS',
 * //         short_name: 'GHRC',
 * //         ignore_case: false
 * //       }
 * //     }
 * //   }
 * // }
 */
export const createCmrCollectionQuery = ({
  scheme,
  uuid,
  prefLabel,
  fullPath,
  isLeaf
}) => {
  const cmrScheme = getCmrCollectionSchemeName(scheme)

  if (['science_keywords', 'platform', 'instrument', 'location_keyword'].includes(cmrScheme)) {
    return {
      cmrScheme,
      method: 'POST',
      queryType: 'uuid',
      query: {
        condition: {
          [cmrScheme]: {
            uuid
          }
        }
      }
    }
  }

  if (['project', 'processing_level_id'].includes(cmrScheme)) {
    return {
      cmrScheme,
      method: 'POST',
      queryType: 'prefLabel',
      query: {
        condition: {
          [cmrScheme]: prefLabel
        }
      }
    }
  }

  if (cmrScheme === 'data_center') {
    return {
      cmrScheme,
      method: 'POST',
      queryType: 'hierarchy',
      query: {
        condition: {
          [cmrScheme]: buildCmrHierarchyCondition({
            hierarchyFields: ['level_0', 'level_1', 'level_2', 'level_3'],
            keywordList: getCmrProviderHierarchySegments({
              fullPath,
              isLeaf
            }),
            prefLabelField: isLeaf ? 'short_name' : null,
            prefLabelParam: isLeaf ? prefLabel : null
          })
        }
      }
    }
  }

  return {
    cmrScheme,
    method: 'GET',
    queryType: 'queryString',
    query: `${cmrScheme}=${encodeURIComponent(prefLabel)}`
  }
}
