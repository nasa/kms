import { parseCsv } from './parseCsv'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Parses full-path CSV content into a map of canonical full path to UUID.
 *
 * @param {string} csvContent CSV export text for a full-path scheme.
 * @returns {Map<string, string>} Map of canonical full path to concept UUID.
 */
export const parseFullPathCsvRecords = (csvContent) => {
  const rows = parseCsv(csvContent)
  const dataRows = rows.slice(2).filter((row) => row && row.length >= 2)

  return new Map(dataRows.map((row) => {
    const uuid = trimKeywordPathSegment(row[row.length - 1])
    const fullPath = row
      .slice(0, -1)
      .map((column) => trimKeywordPathSegment(column))
      .join(' > ')

    return [fullPath, uuid]
  }))
}
