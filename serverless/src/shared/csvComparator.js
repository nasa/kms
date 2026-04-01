import { parse } from 'csv-parse/sync'

/**
 * Utility class to compare two CSV contents based on UUIDs and fullpaths
 */
export class CsvComparator {
  /**
   * Initialize the comparator
   * @param {number} skipHeaderRows - Number of header rows to skip (default: 1)
   * @param {string} pathSeparator - Separator for path elements (default: ' > ')
   */
  constructor(skipHeaderRows = 2, pathSeparator = ' > ') {
    this.skipHeaderRows = skipHeaderRows
    this.pathSeparator = pathSeparator
  }

  /**
   * Parse CSV content and return a map of UUID to path string
   * @param {string} csvContent - CSV content as a string
   * @returns {Map<string, string>} Map with UUID as key and path string as value
   */
  parseCsvContent(csvContent) {
    const rows = parse(csvContent, {
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    })

    // Skip header rows and filter valid rows
    const dataRows = rows.slice(this.skipHeaderRows).filter((row) => row && row.length >= 2)

    // Convert rows to Map entries
    const entries = dataRows.map((row) => {
      // Last column is UUID, everything before is the fullpath
      const uuid = row[row.length - 1].trim()

      // Join all columns before UUID with the separator, filtering out empty strings
      const pathElements = row
        .slice(0, -1)
        .map((col) => col.trim())
        .filter((col) => col.length > 0)

      const path = pathElements.join(this.pathSeparator)

      return [uuid, path]
    })

    return new Map(entries)
  }

  /**
   * Compare two CSV contents and identify differences
   * @param {string} oldCsvContent - Old CSV content as a string
   * @param {string} newCsvContent - New CSV content as a string
   * @returns {Object} ComparisonResult containing added, removed, and changed keywords
   */
  compare(oldCsvContent, newCsvContent) {
    const oldRecords = this.parseCsvContent(oldCsvContent)
    const newRecords = this.parseCsvContent(newCsvContent)

    const oldUuids = Array.from(oldRecords.keys())
    const newUuids = Array.from(newRecords.keys())
    const oldUuidsSet = new Set(oldUuids)
    const newUuidsSet = new Set(newUuids)

    // Find added UUIDs (in new but not in old)
    const addedEntries = newUuids
      .filter((uuid) => !oldUuidsSet.has(uuid))
      .map((uuid) => [
        uuid,
        {
          oldPath: undefined,
          newPath: newRecords.get(uuid)
        }
      ])

    // Find removed UUIDs (in old but not in new)
    const removedEntries = oldUuids
      .filter((uuid) => !newUuidsSet.has(uuid))
      .map((uuid) => [
        uuid,
        {
          oldPath: oldRecords.get(uuid),
          newPath: undefined
        }
      ])

    // Find UUIDs with changed paths (present in both)
    const changedEntries = oldUuids
      .filter((uuid) => newUuidsSet.has(uuid))
      .map((uuid) => {
        const oldPath = oldRecords.get(uuid)
        const newPath = newRecords.get(uuid)

        return {
          uuid,
          oldPath,
          newPath
        }
      })
      .filter(({ oldPath, newPath }) => oldPath !== newPath)
      .map(({ uuid, oldPath, newPath }) => [
        uuid,
        {
          oldPath,
          newPath
        }
      ])

    return {
      addedKeywords: new Map(addedEntries),
      removedKeywords: new Map(removedEntries),
      changedKeywords: new Map(changedEntries)
    }
  }

  /**
   * Get a summary of the comparison results
   * @param {Object} result - ComparisonResult object
   * @returns {Object} Summary object with counts
   */
  getSummary(result) {
    return {
      addedCount: result.addedKeywords.size,
      removedCount: result.removedKeywords.size,
      changedCount: result.changedKeywords.size
    }
  }

  /**
   * Export results to JSON format
   * @param {Object} result - ComparisonResult object
   * @returns {Object} JSON object with serialized maps
   */
  toJSON(result) {
    return {
      addedKeywords: Object.fromEntries(result.addedKeywords),
      removedKeywords: Object.fromEntries(result.removedKeywords),
      changedKeywords: Object.fromEntries(result.changedKeywords)
    }
  }
}
