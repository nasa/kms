import { buildKeywordObjectFromPath } from './buildKeywordObjectFromPath'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'
import { parseCsv } from './parseCsv'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Parses short-name CSV content into lookup records with full-path and keyword-object metadata.
 *
 * @param {Object} params The short-name CSV parse input.
 * @param {string} params.csvContent CSV export text for a short-name scheme.
 * @param {string} params.scheme Keyword scheme name.
 * @returns {Map<string, Object>} Map of short name to cached lookup metadata.
 */
export const parseShortNameCsvRecords = ({
  csvContent,
  scheme
}) => {
  const rows = parseCsv(csvContent)
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const shortNameColumn = normalizedScheme === 'providers' ? -4 : -3
  const longNameColumn = normalizedScheme === 'providers' ? -3 : -2
  const providerUrlColumn = normalizedScheme === 'providers' ? -2 : null
  const minColumns = normalizedScheme === 'providers' ? 4 : 3
  const dataRows = rows.slice(2).filter((row) => row && row.length >= minColumns)

  return new Map(dataRows
    .map((row) => {
      const uuid = trimKeywordPathSegment(row[row.length - 1])
      const shortName = trimKeywordPathSegment(row[row.length + shortNameColumn])
      const longName = trimKeywordPathSegment(row[row.length + longNameColumn])
      const providerUrl = providerUrlColumn === null
        ? ''
        : trimKeywordPathSegment(row[row.length + providerUrlColumn])
      const pathEndIndex = normalizedScheme === 'providers' ? -3 : -2
      const fullPath = row
        .slice(0, pathEndIndex)
        .map((column) => trimKeywordPathSegment(column))
        .join(' > ')
      const keywordObject = buildKeywordObjectFromPath({
        scheme: normalizedScheme,
        keywordPath: fullPath
      })

      if (longName) {
        keywordObject.LongName = longName
      }

      if (providerUrl) {
        keywordObject.DataCenterUrl = providerUrl
      }

      return [shortName, {
        uuid,
        fullPath,
        longName,
        providerUrl,
        keywordObject
      }]
    })
    .filter(([shortName]) => shortName))
}
