import { createCsv } from '../createCsv'
import { createCsvMetadata } from '../createCsvMetadata'
import { generateCsvHeaders } from '../generateCsvHeaders'
import { getCsvHeaders } from '../getCsvHeaders'
import { getLongNamesMap } from '../getLongNamesMap'
import { getMaxLengthOfSubArray } from '../getMaxLengthOfSubArray'
import { getNarrowers } from '../getNarrowers'
import { getNarrowersMap } from '../getNarrowersMap'
import { getProviderUrlsMap } from '../getProviderUrlsMap'
import { getRootConceptForScheme } from '../getRootConceptForScheme'
import { isCsvLongNameFlag } from '../isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from '../isCsvProviderUrlFlag'

import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'

/**
 * Pads or repositions keyword path columns so a hierarchy row fits the scheme's CSV layout.
 *
 * This is exported because callers and tests sometimes need the exact row-shaping behavior
 * without generating an entire CSV payload.
 *
 * @param {object} params - CSV path formatting inputs.
 * @param {string} params.scheme - KMS keyword scheme.
 * @param {number} params.csvHeadersCount - Number of CSV header columns before UUID and extras are appended.
 * @param {string[]} params.path - Current hierarchy path segments.
 * @param {boolean} params.isLeaf - Whether the row represents a leaf concept.
 * @returns {string[]} The same `path` array after any required padding/repositioning.
 *
 * @example
 * // Request
 * const rowPath = formatKeywordCsvPath({
 *   scheme: 'providers',
 *   csvHeadersCount: 6,
 *   path: ['NASA', 'GHRC'],
 *   isLeaf: true
 * })
 *
 * // Response
 * // ['NASA', '', 'GHRC']
 */
export const formatKeywordCsvPath = ({
  scheme,
  csvHeadersCount,
  path,
  isLeaf
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (['platforms', 'instruments', 'projects'].includes(normalizedScheme)) {
    const maxLevel = csvHeadersCount - 2

    if (maxLevel === path.length) {
      return path
    }

    while (maxLevel > path.length) {
      if (!isLeaf) {
        path.push('')
      } else {
        path.splice(path.length - 1, 0, '')
      }
    }

    return path
  }

  if (
    [
      'sciencekeywords',
      'chronounits',
      'locations',
      'discipline',
      'rucontenttype',
      'measurementname'
    ].includes(normalizedScheme)
  ) {
    const maxLevel = csvHeadersCount - 1

    if (maxLevel === path.length) {
      return path
    }

    if (maxLevel > path.length) {
      while (maxLevel > path.length) {
        path.push('')
      }

      return path
    }
  }

  if (normalizedScheme === 'providers') {
    const maxLevel = csvHeadersCount - 3

    if (maxLevel === path.length) {
      return path
    }

    if ((maxLevel > path.length) && !isLeaf) {
      while (maxLevel > path.length) {
        path.push('')
      }

      return path
    }

    if ((maxLevel > path.length) && isLeaf) {
      while (maxLevel > path.length) {
        path.splice(path.length - 1, 0, '')
      }

      return path
    }
  }

  return path
}

const appendHierarchicalCsvRows = async ({
  csvHeadersCount,
  providerUrlsMap,
  longNamesMap,
  scheme,
  n,
  map,
  path,
  paths
}) => {
  const currentPath = path
  const { narrowerPrefLabel, uri } = n
  const uuid = n.uri?.split('/')[n.uri.split('/').length - 1]
  const longNameValue = longNamesMap[n.uri]
  const providerUrlsValue = providerUrlsMap[n.uri]

  currentPath.push(narrowerPrefLabel)

  const narrowers = getNarrowers(uri, map)
  const isLeaf = narrowers.length === 0

  await Promise.all(narrowers.map((obj) => appendHierarchicalCsvRows({
    csvHeadersCount,
    providerUrlsMap,
    longNamesMap,
    scheme,
    n: obj,
    map,
    path: [...currentPath],
    paths
  })))

  if (currentPath.length > 1) {
    currentPath.shift()

    formatKeywordCsvPath({
      scheme,
      csvHeadersCount,
      path: currentPath,
      isLeaf
    })

    if (isCsvLongNameFlag(scheme)) {
      currentPath.push(longNameValue || '')
    }

    if (isCsvProviderUrlFlag(scheme)) {
      currentPath.push(providerUrlsValue ? providerUrlsValue[0] : '')
    }

    currentPath.push(uuid)
    paths.push(currentPath)
  }
}

const getCsvRowsForScheme = async ({
  scheme,
  csvHeadersCount,
  version
}) => {
  const csvRows = []
  const roots = await getRootConceptForScheme(scheme, version)
  const narrowersMap = await getNarrowersMap(scheme, version)
  const longNamesMap = await getLongNamesMap(scheme, version)

  let providerUrlsMap = []
  if (normalizeKeywordScheme(scheme) === 'providers') {
    providerUrlsMap = await getProviderUrlsMap(scheme, version)
  }

  await Promise.all((roots || []).map(async (root) => {
    const node = {
      prefLabel: root?.prefLabel?.value,
      narrowerPrefLabel: root?.prefLabel?.value,
      uri: root?.subject?.value
    }

    await appendHierarchicalCsvRows({
      csvHeadersCount,
      providerUrlsMap,
      longNamesMap,
      scheme,
      n: node,
      map: narrowersMap,
      path: [],
      paths: csvRows
    })
  }))

  return csvRows.reverse()
}

const sortCsvRows = (paths) => {
  paths.sort((line1, line2) => {
    for (let index = 0; index < Math.min(line1.length, line2.length); index += 1) {
      if (line1[index] !== line2[index]) {
        return line1[index].localeCompare(line2[index])
      }
    }

    return line1.length - line2.length
  })
}

/**
 * Builds the full CSV export payload for one concept scheme/version.
 *
 * The result includes metadata rows, headers, and all hierarchical concept rows serialized into a
 * single CSV string.
 *
 * @param {object} params - CSV generation inputs.
 * @param {string} params.scheme - KMS keyword scheme to export.
 * @param {string} params.version - Source version such as `published`, `draft`, or a historical version.
 * @param {string} [params.versionName] - Human-readable version name for metadata rows.
 * @param {string} [params.versionCreationDate] - Version creation timestamp for metadata rows.
 * @returns {Promise<string>} Complete CSV content for the requested scheme/version.
 * @throws {Error} Propagates upstream concept/header/CSV generation errors.
 *
 * @example
 * // Request
 * const csvContent = await getCsvForScheme({
 *   scheme: 'sciencekeywords',
 *   version: 'published',
 *   versionName: '23.3',
 *   versionCreationDate: '2026-02-13T00:00:00Z'
 * })
 *
 * // Response
 * // '"Version","23.3"\n"Category","Topic","Term","UUID"\n"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","2e5a401b-1507-4f57-82b8-36557c13b154"'
 */
export const getCsvForScheme = async ({
  scheme,
  version,
  versionName,
  versionCreationDate
}) => {
  const csvMetadata = createCsvMetadata({
    versionName,
    versionCreationDate,
    scheme
  })
  let csvHeaders = await getCsvHeaders(scheme, version)
  const csvHeadersCount = csvHeaders.length
  const csvRows = await getCsvRowsForScheme({
    scheme,
    csvHeadersCount,
    version
  })

  if (csvHeaders.length === 0) {
    const maxColumns = getMaxLengthOfSubArray(csvRows)
    csvHeaders = await generateCsvHeaders(scheme, version, maxColumns)
  }

  sortCsvRows(csvRows)

  return createCsv(csvMetadata, csvHeaders, csvRows)
}
