import { createChangeNoteItem } from '@/shared/createChangeNoteItem'

/**
 * Creates a structured change note object from raw change note text.
 *
 * @param {string} changeNoteText - The raw text of the change note.
 * @returns {Object} A structured object representing the change note.
 *
 * @description
 * This function takes raw change note text and converts it into a structured object
 * that represents a change note in a specific format. The process involves:
 * 1. Parsing the raw text using the createChangeNoteItem function.
 * 2. Constructing a new object with a specific structure, including:
 *    - Top-level metadata (date, userId, userNote)
 *    - A nested 'changeNoteItems' object containing an array of change note items
 *
 * The resulting object is designed to be easily convertible to XML or other
 * structured formats for further processing or storage.
 *
 * @example
 * const rawText = "Date: 2023-05-15\nUser Id: john_doe\nEntity: User\nOperation: UPDATE";
 * const changeNote = createChangeNote(rawText);
 * // Returns:
 * // {
 * //   "@date": "2023-05-15",
 * //   "@userId": "john_doe",
 * //   "@userNote": undefined,
 * //   "changeNoteItems": {
 * //     "changeNoteItem": [
 * //       {
 * //         "@entity": "User",
 * //         "@operation": "UPDATE",
 * //         "@systemNote": undefined,
 * //         "@newValue": undefined,
 * //         "@oldValue": undefined,
 * //         "@field": undefined
 * //       }
 * //     ]
 * //   }
 * // }
 */
export const createChangeNote = (changeNoteText) => {
  const changeNoteItem = createChangeNoteItem(changeNoteText)

  return {
    '@date': changeNoteItem.date,
    '@userId': changeNoteItem.userId,
    '@userNote': changeNoteItem.userNote,
    changeNoteItems: {
      changeNoteItem: [
        {
          '@systemNote': changeNoteItem.systemNote,
          '@newValue': changeNoteItem.newValue,
          '@oldValue': changeNoteItem.oldValue,
          '@entity': changeNoteItem.entity,
          '@operation': changeNoteItem.operation,
          '@field': changeNoteItem.field
        }
      ]
    }
  }
}
