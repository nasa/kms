import createChangeNoteItem from '@/shared/createChangeNoteItem'

/* eslint-disable no-param-reassign */
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
