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
    if (line.startsWith('date:')) changeNote['@date'] = line.split(':')[1].trim()
    else if (line.startsWith('userId:')) changeNote['@userId'] = line.split(':')[1].trim()
    else if (line.startsWith('userNote:')) changeNote['@userNote'] = line.split(':')[1].trim() || ''
    else if (line === 'ChangeNoteItem #1') {
      currentChangeNoteItem = {}
    } else if (currentChangeNoteItem) {
      if (line.startsWith('systemNote:')) currentChangeNoteItem['@systemNote'] = line.split(':')[1].trim()
      else if (line.startsWith('newValue:')) currentChangeNoteItem['@newValue'] = line.split(':')[1].trim()
      else if (line.startsWith('oldValue:')) currentChangeNoteItem['@oldValue'] = line.split(':')[1].trim()
      else if (line.startsWith('entity:')) currentChangeNoteItem['@entity'] = line.split(':')[1].trim()
      else if (line.startsWith('operation:')) currentChangeNoteItem['@operation'] = line.split(':')[1].trim()
      else if (line.startsWith('field:')) {
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
