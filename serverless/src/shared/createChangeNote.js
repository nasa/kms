/**
 * Creates a change note string and converts it into a structured object.
 *
 * @param {string} note - The change note string to process.
 * @returns {Object} An object representing the processed change note, with the following structure:
 *   {
 *     '@date': string,
 *     '@userId': string,
 *     '@userNote': string,
 *     changeNoteItems: {
 *       changeNoteItem: [
 *         {
 *           '@systemNote': string,
 *           '@newValue': string,
 *           '@oldValue': string,
 *           '@entity': string,
 *           '@operation': string,
 *           '@field': string
 *         },
 *         ...
 *       ]
 *     }
 *   }
 */
const createChangeNote = (note) => {
  const lines = note.split('\n').map((line) => line.trim())
  const changeNote = {
    changeNoteItems: {
      changeNoteItem: []
    }
  }
  let currentChangeNoteItem = null

  lines.forEach((line) => {
    if (line.startsWith('Date:')) changeNote['@date'] = line.split(':')[1].trim()
    else if (line.startsWith('User Id:')) changeNote['@userId'] = line.split(':')[1].trim()
    else if (line.startsWith('User Note:')) changeNote['@userNote'] = line.split(':')[1].trim() || ''
    else if (line.startsWith('Change Note Item #')) {
      if (currentChangeNoteItem) {
        changeNote.changeNoteItems.changeNoteItem.push(currentChangeNoteItem)
      }

      currentChangeNoteItem = {}
    } else if (currentChangeNoteItem) {
      const [key, ...valueParts] = line.split(':')
      const value = valueParts.join(':').trim()
      if (key === 'System Note') currentChangeNoteItem['@systemNote'] = value
      else if (key === 'New Value') currentChangeNoteItem['@newValue'] = value
      else if (key === 'Old Value') currentChangeNoteItem['@oldValue'] = value
      else if (key === 'Entity') currentChangeNoteItem['@entity'] = value
      else if (key === 'Operation') currentChangeNoteItem['@operation'] = value
      else if (key === 'Field') currentChangeNoteItem['@field'] = value
    }
  })

  // Add the last ChangeNoteItem if it exists
  if (currentChangeNoteItem) {
    changeNote.changeNoteItems.changeNoteItem.push(currentChangeNoteItem)
  }

  return changeNote
}

export default createChangeNote
