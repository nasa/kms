import { createChangeNoteItem } from '@/shared/createChangeNoteItem'
import { getConceptChangeNotes } from '@/shared/getConceptChangeNotes'
import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Creates a CSV report from processed change notes.
 *
 * @param {Array} processedChangeNotes - Array of change note objects
 * @param {string|null} userId - Optional user ID to filter notes
 * @param {string} title - Title of the report
 * @param {Array<string>|null} customHeaders - Optional custom headers for the CSV
 * @returns {string} CSV formatted string
 *
 * @example
 * const notes = [
 *   { date: '2023-06-01', userId: 'user1', entity: 'Concept', operation: 'Update', field: 'Label', oldValue: 'Old', newValue: 'New' },
 *   { date: '2023-06-02', userId: 'user2', entity: 'Concept', operation: 'Create', field: 'Definition', oldValue: '', newValue: 'New definition' }
 * ];
 * const csv = createCsvReport(notes, null, 'Change Report');
 * console.log(csv);
 * // Output:
 * // Change Report
 * // "Date","User Id","Entity","Operation","System Note","Field","User Note","Old Value","New Value"
 * // "2023-06-02","user2","Concept","Create","","Definition","","","New definition"
 * // "2023-06-01","user1","Concept","Update","","Label","","Old","New"
 *
 * // With custom headers
 * const customHeaders = ['Date', 'User', 'Action', 'Details'];
 * const customCsv = createCsvReport(notes, null, 'Custom Report', customHeaders);
 * console.log(customCsv);
 * // Output:
 * // Custom Report
 * // "Date","User","Action","Details"
 * // "2023-06-02","user2","Create","Definition: New definition"
 * // "2023-06-01","user1","Update","Label: Old -> New"
 */
export const createCsvReport = (processedChangeNotes, userId, title, customHeaders = null) => {
  const headers = customHeaders || ['Date', 'User Id', 'Entity', 'Operation', 'System Note', 'Field', 'User Note', 'Old Value', 'New Value']
  const result = []
  result.push(title)

  // Helper function to escape and quote a value
  const quoteValue = (value) => {
    if (value === undefined || value === null) {
      return '""'
    }

    // Convert to string and replace any double quotes with two double quotes
    const escaped = String(value).replace(/"/g, '""')

    return `"${escaped}"`
  }

  // Add the headers as the first row, with each header in quotes
  result.push(headers.map(quoteValue).join(','))

  // Filter processedChangeNotes if userId is provided
  const filteredNotes = userId
    ? processedChangeNotes.filter((note) => note.userId === userId)
    : processedChangeNotes

  // Sort the filtered notes by date, newest first
  filteredNotes.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Iterate over the filtered and sorted notes
  filteredNotes.forEach((note) => {
    const row = headers.map((header) => {
      let value
      switch (header) {
        case 'Date':
          value = note.date
          break
        case 'User Id':
          value = note.userId
          break
        case 'Entity':
          value = note.entity
          break
        case 'Operation':
          value = note.operation
          break
        case 'System Note':
          value = note.systemNote
          break
        case 'Field':
          value = note.field
          break
        case 'User Note':
          value = note.userNote
          break
        case 'Old Value':
          value = note.oldValue
          break
        case 'New Value':
          value = note.newValue
          break
        default:
          value = undefined
      }

      return quoteValue(value)
    })

    // Join the quoted row values with commas and add to the result
    result.push(row.join(','))
  })

  return result.join('\n')
}

/**
 * Handles the request to generate a concept updates report.
 *
 * @param {Object} event - The Lambda event object
 * @returns {Object} Response object with status code, body, and headers
 *
 * @example
 * // Example event object:
 * const event = {
 *   queryStringParameters: {
 *     version: '1.0',
 *     startDate: '2023-01-01',
 *     endDate: '2023-06-30',
 *     scheme: 'MyScheme',
 *     userId: 'user123'
 *   }
 * };
 *
 * const response = await getConceptUpdatesReport(event);
 * console.log(response);
 * // Output:
 * // {
 * //   statusCode: 200,
 * //   body: '...CSV content...',
 * //   headers: { ... }
 * // }
 */
export const getConceptUpdatesReport = async (event) => {
  // Extract configuration and parameters
  const { defaultResponseHeaders } = getApplicationConfig()
  const queryStringParameters = event.queryStringParameters || {}

  // Mandatory parameters
  const { version, startDate, endDate } = queryStringParameters

  // Optional parameters
  const { scheme, userId } = queryStringParameters

  // Validate mandatory parameters
  if (!version || !startDate || !endDate) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing mandatory parameter(s). version, startDate, and endDate are required.' }),
      headers: defaultResponseHeaders
    }
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid date format. startDate and endDate must be in yyyy-mm-dd format.' }),
      headers: defaultResponseHeaders
    }
  }

  const changeNoteTriples = await getConceptChangeNotes({
    version,
    scheme,
    startDate,
    endDate
  })

  console.log('CNtriples=', changeNoteTriples)

  // Process change notes
  const processedChangeNotes = changeNoteTriples.map((triple) => {
    const changeNote = createChangeNoteItem(triple.changeNote.value)

    return changeNote
  })

  const title = `Keyword Change Report\nKeyword Version: ${version}, From: ${startDate}, To: ${endDate}`
  const result = createCsvReport(processedChangeNotes, userId, title)
  const fileName = `KeywordUpdateReport-${startDate}-${endDate}`

  // Set CSV response header
  const responseHeaders = {
    ...defaultResponseHeaders,
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename=${fileName}.csv`
  }

  return {
    statusCode: 200,
    body: result,
    headers: responseHeaders
  }
}

export default getConceptUpdatesReport
