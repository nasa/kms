import { parse } from 'csv/sync'

/**
 * Utility class to compare two CSV contents based on UUIDs and fullpaths.
 *
 * This class is designed to compare science keywords CSV files (draft vs published versions)
 * and identify what has been added, removed, or changed between versions.
 *
 * @example
 * // Compare draft and published CSV files
 * const comparator = new CsvComparator()
 * const oldCsv = fs.readFileSync('sciencekeywords-published.csv', 'utf-8')
 * const newCsv = fs.readFileSync('sciencekeywords-draft.csv', 'utf-8')
 *
 * const result = comparator.compare(oldCsv, newCsv)
 * // Result contains:
 * // - addedKeywords: Map of new UUIDs with their paths
 * // - removedKeywords: Map of removed UUIDs with their old paths
 * // - changedKeywords: Map of UUIDs with modified paths
 *
 * @example
 * // Example with actual data:
 * // Old CSV contains:
 * // "EARTH SCIENCE","OCEANS","COASTAL PROCESSES","SHORELINES","SHORELINE MAPPING","","","3472f70b-874f-4dc5-87db-4b3ebc4b9aaa"
 *
 * // New CSV contains:
 * // "EARTH SCIENCE","OCEANS","COASTAL PROCESSES","SHORELINES","SHORELINE MAPPING","","","3472f70b-874f-4dc5-87db-4b3ebc4b9aaa"
 * // "EARTH SCIENCE","OCEANS","COASTAL PROCESSES","SHORELINES","NEW SHORELINES","","","3472f70b-874f-6dc5-87db-4b3ebc4b9a73"
 *
 * const result = comparator.compare(oldCsv, newCsv)
 *
 * // result.addedKeywords will contain:
 * // Map(1) {
 * //   '3472f70b-874f-6dc5-87db-4b3ebc4b9a73' => {
 * //     oldPath: undefined,
 * //     newPath: 'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > SHORELINES > NEW SHORELINES'
 * //   }
 * // }
 *
 * @example
 * // Get summary statistics
 * const summary = comparator.getSummary(result)
 * console.log(summary)
 * // Output: { addedCount: 1, removedCount: 0, changedCount: 0 }
 *
 * @example
 * // Export to JSON format
 * const json = comparator.toJSON(result)
 * console.log(JSON.stringify(json, null, 2))
 * // Output:
 * // {
 * //   "addedKeywords": {
 * //     "3472f70b-874f-6dc5-87db-4b3ebc4b9a73": {
 * //       "oldPath": null,
 * //       "newPath": "EARTH SCIENCE > OCEANS > COASTAL PROCESSES > SHORELINES > NEW SHORELINES"
 * //     }
 * //   },
 * //   "removedKeywords": {},
 * //   "changedKeywords": {}
 * // }
 *
 * @example
 * // Example: Keyword path changed
 * // Old: "EARTH SCIENCE","OCEANS","MARINE GEOPHYSICS","MARINE MAGNETICS","","","","7863ce31-0e06-42a5-bcf8-25981c44dec8"
 * // New: "EARTH SCIENCE","OCEANS","MARINE GEOPHYSICS","MARINE MAGNETICS MODIFIED","","","","7863ce31-0e06-42a5-bcf8-25981c44dec8"
 *
 * // result.changedKeywords will contain:
 * // Map(1) {
 * //   '7863ce31-0e06-42a5-bcf8-25981c44dec8' => {
 * //     oldPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS',
 * //     newPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS MODIFIED'
 * //   }
 * // }
 *
 * @example
 * // Example: Keyword removed
 * // Old: "EARTH SCIENCE","OCEANS","MARINE SEDIMENTS","DIAGENESIS","","","","4bfed15d-b8b4-4fb1-940b-ef342c4c2225"
 * // New: (keyword not present)
 *
 * // result.removedKeywords will contain:
 * // Map(1) {
 * //   '4bfed15d-b8b4-4fb1-940b-ef342c4c2225' => {
 * //     oldPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS > DIAGENESIS',
 * //     newPath: undefined
 * //   }
 * // }
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

    const added = new Map()
    const removed = new Map()
    const changed = new Map()

    // Check all new records for additions and changes
    Array.from(newRecords.entries()).forEach(([uuid, newPath]) => {
      const oldPath = oldRecords.get(uuid)
      if (oldPath === undefined) {
        added.set(uuid, {
          oldPath: undefined,
          newPath
        })
      } else if (oldPath !== newPath) {
        changed.set(uuid, {
          oldPath,
          newPath
        })
      }
    })

    // Check old records for removals
    Array.from(oldRecords.entries()).forEach(([uuid, oldPath]) => {
      if (!newRecords.has(uuid)) {
        removed.set(uuid, {
          oldPath,
          newPath: undefined
        })
      }
    })

    return {
      addedKeywords: added,
      removedKeywords: removed,
      changedKeywords: changed
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
