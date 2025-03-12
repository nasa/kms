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
    else if (line === 'Change Note Item #1') {
      currentChangeNoteItem = {}
    } else if (currentChangeNoteItem) {
      if (line.startsWith('System Note:')) currentChangeNoteItem['@systemNote'] = line.split(':')[1].trim()
      else if (line.startsWith('New Value:')) currentChangeNoteItem['@newValue'] = line.split(':')[1].trim()
      else if (line.startsWith('Old Value:')) currentChangeNoteItem['@oldValue'] = line.split(':')[1].trim()
      else if (line.startsWith('Entity:')) currentChangeNoteItem['@entity'] = line.split(':')[1].trim()
      else if (line.startsWith('Operation:')) currentChangeNoteItem['@operation'] = line.split(':')[1].trim()
      else if (line.startsWith('Field:')) {
        currentChangeNoteItem['@field'] = line.split(':')[1].trim()
        changeNote.changeNoteItems.changeNoteItem.push(currentChangeNoteItem)
        currentChangeNoteItem = null
      }
    }
  })

  // In case the last ChangeNoteItem doesn't have a 'field' property
  if (currentChangeNoteItem) {
    changeNote.changeNoteItems.changeNoteItem.push(currentChangeNoteItem)
  }

  return changeNote
}

module.exports = createChangeNote
