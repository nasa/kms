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

import { getCsvRowValues, prepareCsvRows } from './helpers/keywordCsv'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'

const appendHierarchicalCsvRows = async ({
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

    paths.push({
      path: currentPath,
      isLeaf,
      uuid,
      longName: longNameValue || '',
      dataCenterUrl: providerUrlsValue ? providerUrlsValue[0] : ''
    })
  }
}

const getCsvRowsForScheme = async ({
  scheme,
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
 * const csvContent = await createCsvForScheme({
 *   scheme: 'sciencekeywords',
 *   version: 'published',
 *   versionName: '23.3',
 *   versionCreationDate: '2026-02-13T00:00:00Z'
 * })
 *
 * // Response
 * // '"Version","23.3"\n"Category","Topic","Term","UUID"\n"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","2e5a401b-1507-4f57-82b8-36557c13b154"'
 */
export const createCsvForScheme = async ({
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
  const csvRows = await getCsvRowsForScheme({
    scheme,
    version
  })

  if (csvHeaders.length === 0) {
    const maxColumns = getMaxLengthOfSubArray(csvRows.map((row) => getCsvRowValues({
      ...row,
      scheme
    })))
    csvHeaders = await generateCsvHeaders(scheme, version, maxColumns)
  }

  return createCsv(csvMetadata, csvHeaders, prepareCsvRows({
    csvHeaders,
    csvRows,
    scheme
  }))
}
