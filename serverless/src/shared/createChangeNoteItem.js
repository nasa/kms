import { camelCase } from 'lodash'

/**
 * Parses a raw text containing change note information and converts it into a structured object.
 *
 * @param {string} rawText - The raw text containing change note information.
 * @returns {Object} An object with parsed change note fields.
 *
 * @description
 * This function processes the raw text of a change note and extracts structured information.
 * The logic works as follows:
 * 1. The raw text is split into words and whitespace.
 * 2. The function iterates through these words, building a buffer.
 * 3. It looks for predefined fields (e.g., 'Date', 'User Id', etc.) in the buffer.
 * 4. When a field is found:
 *    - If there was no previous field, it starts processing the new field.
 *    - If there was a previous field, it saves its value and starts processing the new field.
 * 5. The process continues until all words are processed.
 * 6. The last field's value is saved after the loop.
 * 7. If no fields were found at all, the entire raw text is stored under an 'other' key.
 * 8. All field names in the result object are converted to camelCase.
 *
 * This approach allows the function to handle both single-line and multi-line field values,
 * as well as multiple fields on the same line. It's also resilient to unexpected formats,
 * capturing all text even if it doesn't match the expected structure.
 */
export const createChangeNoteItem = (rawText) => {
  let fields = ['Date', 'User Id', 'Entity', 'Operation', 'System Note', 'Field', 'User Note', 'Old Value', 'New Value']
  const result = {}
  let currentFieldInScope = null
  let buffer = []
  const findFieldMatch = (text) => fields.find((field) => text.includes(`${field}=`))
  const words = rawText.split(/(\s+)/)
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]
    buffer.push(word)
    if (!currentFieldInScope) {
      const fieldMatch = findFieldMatch(buffer.join(''))
      if (fieldMatch) {
        currentFieldInScope = fieldMatch
        buffer = [buffer.join('').slice(buffer.join('').indexOf(`${fieldMatch}=`) + fieldMatch.length + 1)]
      }
    } else {
      const nextFieldMatch = findFieldMatch(buffer.join(''))
      if (nextFieldMatch) {
        result[camelCase(currentFieldInScope)] = buffer.join('').slice(0, buffer.join('').indexOf(`${nextFieldMatch}=`)).trim()
        const fieldToRemove = currentFieldInScope // Capture the current value
        fields = fields.filter((field) => field !== fieldToRemove)
        currentFieldInScope = nextFieldMatch
        buffer = [buffer.join('').slice(buffer.join('').indexOf(`${nextFieldMatch}=`) + nextFieldMatch.length + 1)]
      }
    }
  }

  if (currentFieldInScope) {
    result[camelCase(currentFieldInScope)] = buffer.join('').trim()
  }

  return Object.keys(result).length ? result : { other: rawText }
}
