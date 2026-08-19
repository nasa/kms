import { parse } from 'csv/sync'

import { isCsvLongNameFlag } from '@/shared/isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from '@/shared/isCsvProviderUrlFlag'

import { buildKeywordObjectFromPath } from './buildKeywordObjectFromPath'
import {
  CSV_PATH_FIELDS,
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

const AUXILIARY_CSV_HEADERS = new Set(['uuid', 'longname', 'datacenterurl'])

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
  const pathFieldsCount = CSV_PATH_FIELDS[normalizedScheme]?.length ?? path.length

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
  const configuredFields = CSV_PATH_FIELDS[normalizeKeywordScheme(scheme)]
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

  const pathHeaders = configuredFields.map(normalizeCsvHeader)

  return sortedRows.map((row) => {
    const path = formatKeywordCsvPath({
      scheme,
      path: [...row.path],
      isLeaf: row.isLeaf
    })
    const record = Object.fromEntries(
      pathHeaders.map((header, index) => [header, path[index] || ''])
    )

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
 * @returns {{uuid: string, shortName: string, longName: string, providerUrl: string, keywordPath: string}[]}
 * Parsed keyword records.
 *
 * @example
 * parseCsv(
 *   '"Version"\n"Long_Name","UUID","Type","Short_Name","Category","Class"\n'
 *     + '"Greenhouse Gases Observing Satellite","uuid-1","Earth Observation Satellites","GOSAT","Platforms","Space-based Platforms"',
 *   { scheme: 'platforms' }
 * )
 * // Returns: [{
 * //   uuid: 'uuid-1',
 * //   shortName: 'GOSAT',
 * //   longName: 'Greenhouse Gases Observing Satellite',
 * //   providerUrl: '',
 * //   keywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > GOSAT'
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
  const configuredFields = CSV_PATH_FIELDS[normalizedScheme]
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

  return rows.map((row) => ({
    uuid: trimKeywordPathSegment(row.uuid),
    shortName: trimKeywordPathSegment(row.shortname),
    longName: trimKeywordPathSegment(row.longname),
    providerUrl: trimKeywordPathSegment(row.datacenterurl),
    keywordPath: pathHeaders
      .map((header) => trimKeywordPathSegment(row[header]))
      .join(pathSeparator)
  }))
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
 *   '"Version"\n"Category","Class","Type","Short_Name","Long_Name","UUID"\n'
 *     + '"Platforms","Space-based Platforms","Satellite","GOSAT","Greenhouse Gases Observing Satellite","uuid-1"',
 *   { scheme: 'platforms' }
 * )
 * // Returns: Map([['uuid-1', {
 * //   path: 'Platforms > Space-based Platforms > Satellite > GOSAT',
 * //   keywordObject: {
 * //     Category: 'Platforms',
 * //     Class: 'Space-based Platforms',
 * //     Type: 'Satellite',
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

  return new Map(
    records
      .map(({
        keywordPath,
        longName,
        providerUrl,
        uuid
      }) => {
        const keywordObject = buildKeywordObjectFromPath({
          scheme: normalizedScheme,
          keywordPath
        })

        if (isCsvLongNameFlag(normalizedScheme) && longName) {
          keywordObject.LongName = longName
        }

        if (isCsvProviderUrlFlag(normalizedScheme) && providerUrl) {
          keywordObject.DataCenterUrl = providerUrl
        }

        return [uuid, {
          path: keywordPath,
          keywordObject: hasKeywordObjectValue(keywordObject) ? keywordObject : undefined
        }]
      })
  )
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
 *   csvContent: '"Version"\n"Category","Class","Type","Short_Name","Long_Name","UUID"\n'
 *     + '"Platforms","Space-based Platforms","Satellite","GOSAT","GOSAT Satellite","uuid-1"',
 *   scheme: 'platforms'
 * })
 * // Returns: Map([['GOSAT', {
 * //   uuid: 'uuid-1',
 * //   fullPath: 'Platforms > Space-based Platforms > Satellite > GOSAT',
 * //   longName: 'GOSAT Satellite',
 * //   providerUrl: '',
 * //   keywordObject: {
 * //     Category: 'Platforms',
 * //     Class: 'Space-based Platforms',
 * //     Type: 'Satellite',
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

  return new Map(parseCsv(csvContent, {
    scheme: normalizedScheme
  })
    .filter(({ shortName }) => shortName)
    .map(({
      keywordPath,
      longName,
      providerUrl,
      shortName,
      uuid
    }) => {
      const keywordObject = buildKeywordObjectFromPath({
        scheme: normalizedScheme,
        keywordPath
      })

      if (longName) {
        keywordObject.LongName = longName
      }

      if (providerUrl) {
        keywordObject.DataCenterUrl = providerUrl
      }

      return [shortName, {
        uuid,
        fullPath: keywordPath,
        longName,
        providerUrl,
        keywordObject
      }]
    }))
}
