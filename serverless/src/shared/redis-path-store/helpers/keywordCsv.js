import { parse } from 'csv/sync'

import { isCsvLongNameFlag } from '@/shared/isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from '@/shared/isCsvProviderUrlFlag'

import { buildKeywordObjectFromPath } from './buildKeywordObjectFromPath'
import {
  AUXILIARY_CSV_HEADERS,
  CSV_FIELDS,
  KEYWORD_DIFF_SKIP_HEADER_ROWS,
  KEYWORD_PATH_SEPARATOR
} from './constants'
import { hasKeywordObjectValue } from './hasKeywordObjectValue'
import { isLookupShortNameScheme } from './isLookupShortNameScheme'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Normalizes CSV and scheme field names to the same lookup key.
 *
 * @example
 * normalizeCsvHeader('Short_Name')
 * // Returns: 'shortname'
 *
 * normalizeCsvHeader('Data_Center_URL')
 * // Returns: 'datacenterurl'
 */
export const normalizeCsvHeader = (header) => String(header)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

/**
 * Pads a hierarchy path to the number of fields configured for its scheme. Leaf values for
 * short-name schemes stay in the final field.
 *
 * @param {object} params CSV path formatting input.
 * @param {string} params.scheme Keyword scheme.
 * @param {string[]} params.path Hierarchy path segments.
 * @param {boolean} params.isLeaf Whether the row represents a leaf concept.
 * @returns {string[]} Padded hierarchy path.
 *
 * @example
 * formatKeywordCsvPath({
 *   scheme: 'providers',
 *   path: ['ACADEMIC', 'GHRC_DAAC'],
 *   isLeaf: true
 * })
 * // Returns: ['ACADEMIC', '', '', '', 'GHRC_DAAC']
 */
export const formatKeywordCsvPath = ({
  scheme,
  path,
  isLeaf
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const pathFieldsCount = CSV_FIELDS[normalizedScheme]?.length ?? path.length

  while (pathFieldsCount > path.length) {
    if (isLookupShortNameScheme(normalizedScheme) && isLeaf) {
      path.splice(path.length - 1, 0, '')
    } else {
      path.push('')
    }
  }

  return path
}

/**
 * Returns a hierarchy row's values in canonical order for column counting and sorting.
 *
 * @param {object} row CSV hierarchy row.
 * @returns {string[]} Canonically ordered row values.
 *
 * @example
 * getCsvRowValues({
 *   path: ['Platforms', 'GOSAT'],
 *   longName: 'Greenhouse Gases Observing Satellite',
 *   dataCenterUrl: '',
 *   uuid: 'uuid-1',
 *   scheme: 'platforms'
 * })
 * // Returns: ['Platforms', 'GOSAT', 'Greenhouse Gases Observing Satellite', 'uuid-1']
 */
export const getCsvRowValues = ({
  dataCenterUrl,
  longName,
  path,
  scheme,
  uuid
}) => [
  ...path,
  ...(isCsvLongNameFlag(scheme) ? [longName] : []),
  ...(isCsvProviderUrlFlag(scheme) ? [dataCenterUrl] : []),
  uuid
]

/**
 * Maps a hierarchy row to its canonical named CSV path fields.
 *
 * @param {object} params CSV path-record input.
 * @param {string[]} params.configuredFields Canonical fields for the scheme.
 * @param {object} params.row Hierarchy row to map.
 * @param {string} params.scheme Keyword scheme.
 * @returns {Record<string, string>} Values keyed by normalized CSV header.
 */
const buildCsvPathRecord = ({
  configuredFields,
  row,
  scheme
}) => {
  const path = formatKeywordCsvPath({
    scheme,
    path: [...row.path],
    isLeaf: row.isLeaf
  })

  return Object.fromEntries(configuredFields.map((field, index) => [
    normalizeCsvHeader(field),
    path[index] || ''
  ]))
}

/**
 * Sorts hierarchy rows and places each value under its named CSV header.
 *
 * @param {object} params CSV row preparation input.
 * @param {string[]} params.csvHeaders CSV headers in output order.
 * @param {object[]} params.csvRows Hierarchy rows to prepare.
 * @param {string} params.scheme Keyword scheme.
 * @returns {string[][]} Sorted CSV values in output header order.
 *
 * @example
 * prepareCsvRows({
 *   csvHeaders: ['UUID', 'Short_Name', 'Long_Name'],
 *   csvRows: [{
 *     path: ['GOSAT'],
 *     isLeaf: true,
 *     uuid: 'uuid-1',
 *     longName: 'Greenhouse Gases Observing Satellite',
 *     dataCenterUrl: ''
 *   }],
 *   scheme: 'platforms'
 * })
 * // Returns: [['uuid-1', 'GOSAT', 'Greenhouse Gases Observing Satellite']]
 */
export const prepareCsvRows = ({
  csvHeaders,
  csvRows,
  scheme
}) => {
  const configuredFields = CSV_FIELDS[normalizeKeywordScheme(scheme)]
  const sortedRows = [...csvRows].sort((first, second) => {
    const firstValues = getCsvRowValues({
      ...first,
      scheme
    })
    const secondValues = getCsvRowValues({
      ...second,
      scheme
    })

    for (let index = 0; index < Math.min(firstValues.length, secondValues.length); index += 1) {
      if (firstValues[index] !== secondValues[index]) {
        return firstValues[index].localeCompare(secondValues[index])
      }
    }

    return firstValues.length - secondValues.length
  })

  if (!configuredFields) {
    return sortedRows.map((row) => getCsvRowValues({
      ...row,
      scheme
    }))
  }

  return sortedRows.map((row) => {
    const record = buildCsvPathRecord({
      configuredFields,
      row,
      scheme
    })

    record.uuid = row.uuid

    if (isCsvLongNameFlag(scheme)) record.longname = row.longName
    if (isCsvProviderUrlFlag(scheme)) record.datacenterurl = row.dataCenterUrl

    return csvHeaders.map((header) => record[normalizeCsvHeader(header)] || '')
  })
}

/**
 * Parses keyword CSV rows using named columns and the scheme's canonical path-field order.
 *
 * @param {string} csvContent CSV text content.
 * @param {object} [options={}] Parse options.
 * @param {string} options.scheme Keyword scheme.
 * @param {number} [options.headerRow=2] One-based line containing the CSV headers.
 * @param {string} [options.pathSeparator=KEYWORD_PATH_SEPARATOR] Keyword-path separator.
 * @returns {{uuid: string, shortName: string, longName: string, providerUrl: string,
 * keywordPath: string, keywordObject: Record<string, string>|undefined}[]} Parsed keyword records.
 *
 * @example
 * parseCsv(
 *   '"Version"\n"Long_Name","UUID","Category","Short_Name","Basis","Sub_Category"\n'
 *     + '"Greenhouse Gases Observing Satellite","uuid-1","Earth Observation Satellites","GOSAT","Space-based Platforms",""',
 *   { scheme: 'platforms' }
 * )
 * // Returns: [{
 * //   uuid: 'uuid-1',
 * //   shortName: 'GOSAT',
 * //   longName: 'Greenhouse Gases Observing Satellite',
 * //   providerUrl: '',
 * //   keywordPath: 'Space-based Platforms > Earth Observation Satellites >  > GOSAT'
 * // }]
 */
export const parseCsv = (
  csvContent,
  {
    scheme,
    headerRow = 2,
    pathSeparator = KEYWORD_PATH_SEPARATOR
  } = {}
) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const configuredFields = CSV_FIELDS[normalizedScheme]
  let pathHeaders = []
  const rows = parse(csvContent || '', {
    columns: (headers) => {
      const normalizedHeaders = headers.map(normalizeCsvHeader)

      pathHeaders = (configuredFields || normalizedHeaders.filter(
        (header) => !AUXILIARY_CSV_HEADERS.has(header)
      )).map(normalizeCsvHeader)

      return normalizedHeaders
    },
    from_line: headerRow,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  })

  return rows.map((row) => {
    const keywordPath = pathHeaders
      .map((header) => trimKeywordPathSegment(row[header]))
      .join(pathSeparator)
    const keywordObject = configuredFields
      ? Object.fromEntries([
        ...configuredFields,
        ...(isCsvLongNameFlag(normalizedScheme) ? ['LongName'] : []),
        ...(isCsvProviderUrlFlag(normalizedScheme) ? ['DataCenterURL'] : [])
      ].map((field) => [
        field,
        trimKeywordPathSegment(row[normalizeCsvHeader(field)])
      ]))
      : buildKeywordObjectFromPath({
        scheme: normalizedScheme,
        keywordPath
      })

    return {
      uuid: trimKeywordPathSegment(row.uuid),
      shortName: trimKeywordPathSegment(row.shortname),
      longName: trimKeywordPathSegment(row.longname),
      providerUrl: trimKeywordPathSegment(row.datacenterurl),
      keywordPath,
      keywordObject
    }
  })
}

/**
 * Parses keyword CSV content into records used to compare rows and create event objects.
 *
 * @param {string} csvContent - Raw CSV content to parse.
 * @param {object} [options={}] - Parse options.
 * @param {string} options.scheme - Scheme used to place named columns in canonical path order.
 * @param {number} [options.skipHeaderRows=KEYWORD_DIFF_SKIP_HEADER_ROWS] - Number of leading rows to ignore.
 * @param {string} [options.pathSeparator=KEYWORD_PATH_SEPARATOR] - Separator used to flatten path columns.
 * @returns {Map<string, { path: string, keywordObject: object|undefined }>} Records by UUID.
 *
 * @example
 * parseKeywordCsvContent(
 *   '"Version"\n"Basis","Category","Sub_Category","Short_Name","Long_Name","UUID"\n'
 *     + '"Space-based Platforms","Earth Observation Satellites","","GOSAT","Greenhouse Gases Observing Satellite","uuid-1"',
 *   { scheme: 'platforms' }
 * )
 * // Returns: Map([['uuid-1', {
 * //   path: 'Space-based Platforms > Earth Observation Satellites >  > GOSAT',
 * //   keywordObject: {
 * //     Basis: 'Space-based Platforms',
 * //     Category: 'Earth Observation Satellites',
 * //     SubCategory: '',
 * //     ShortName: 'GOSAT',
 * //     LongName: 'Greenhouse Gases Observing Satellite'
 * //   }
 * // }]])
 */
export const parseKeywordCsvContent = (
  csvContent,
  {
    scheme,
    skipHeaderRows = KEYWORD_DIFF_SKIP_HEADER_ROWS,
    pathSeparator = KEYWORD_PATH_SEPARATOR
  } = {}
) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const records = parseCsv(csvContent, {
    scheme: normalizedScheme,
    headerRow: skipHeaderRows,
    pathSeparator
  }).filter(({ uuid }) => uuid)

  return new Map(records
    .map(({
      keywordPath,
      keywordObject,
      uuid
    }) => [uuid, {
      path: keywordPath,
      keywordObject: hasKeywordObjectValue(keywordObject) ? keywordObject : undefined
    }]))
}

/**
 * Parses full-path CSV content into a map of canonical full path to UUID.
 *
 * @param {object} params Full-path CSV parse input.
 * @param {string} params.csvContent CSV export text for a full-path scheme.
 * @param {string} params.scheme Keyword scheme name.
 * @returns {Map<string, string>} Map of canonical full path to concept UUID.
 *
 * @example
 * parseFullPathCsvRecords({
 *   csvContent: '"Version"\n"Category","Topic","Term","UUID"\n'
 *     + '"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"',
 *   scheme: 'sciencekeywords'
 * })
 * // Returns: Map([
 * //   ['EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ', 'uuid-1']
 * // ])
 */
export const parseFullPathCsvRecords = ({
  csvContent,
  scheme
}) => new Map(parseCsv(csvContent, {
  scheme
})
  .filter(({ uuid }) => uuid)
  .map(({ keywordPath, uuid }) => [keywordPath, uuid]))

/**
 * Parses short-name CSV content into lookup records with full-path and keyword-object metadata.
 *
 * @param {Object} params The short-name CSV parse input.
 * @param {string} params.csvContent CSV export text for a short-name scheme.
 * @param {string} params.scheme Keyword scheme name.
 * @returns {Map<string, Object>} Map of short name to cached lookup metadata.
 *
 * @example
 * parseShortNameCsvRecords({
 *   csvContent: '"Version"\n"Basis","Category","Sub_Category","Short_Name","Long_Name","UUID"\n'
 *     + '"Space-based Platforms","Earth Observation Satellites","","GOSAT","GOSAT Satellite","uuid-1"',
 *   scheme: 'platforms'
 * })
 * // Returns: Map([['GOSAT', {
 * //   uuid: 'uuid-1',
 * //   fullPath: 'Space-based Platforms > Earth Observation Satellites >  > GOSAT',
 * //   longName: 'GOSAT Satellite',
 * //   providerUrl: '',
 * //   keywordObject: {
 * //     Basis: 'Space-based Platforms',
 * //     Category: 'Earth Observation Satellites',
 * //     SubCategory: '',
 * //     ShortName: 'GOSAT',
 * //     LongName: 'GOSAT Satellite'
 * //   }
 * // }]])
 */
export const parseShortNameCsvRecords = ({
  csvContent,
  scheme
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  const records = parseCsv(csvContent, {
    scheme: normalizedScheme
  }).filter(({ shortName }) => shortName)

  return new Map(records
    .map(({
      keywordPath,
      longName,
      providerUrl,
      shortName,
      uuid,
      keywordObject
    }) => [shortName, {
      uuid,
      fullPath: keywordPath,
      longName,
      providerUrl,
      keywordObject
    }]))
}
