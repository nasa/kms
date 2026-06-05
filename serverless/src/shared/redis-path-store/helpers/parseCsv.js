import { parse } from 'csv/sync'

/**
 * Parses CSV content using the relaxed options shared across redis-path-store helpers.
 *
 * @param {string} csvContent CSV text content.
 * @returns {string[][]} Parsed CSV rows.
 */
export const parseCsv = (csvContent) => parse(csvContent, {
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true
})
