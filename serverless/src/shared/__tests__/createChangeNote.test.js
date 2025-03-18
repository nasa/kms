import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { createChangeNote } from '../createChangeNote'

// Import the mocked function
import { createChangeNoteItem } from '../createChangeNoteItem'

// Mock createChangeNoteItem as a named export
vi.mock('../createChangeNoteItem', () => ({
  createChangeNoteItem: vi.fn()
}))

describe('createChangeNote', () => {
  test('should create a change note with the correct structure', () => {
    const rawChangeNote = `
      Date: 2023-05-15
      User Id: john_doe
      User Note: This is a user note
      Entity: User
      Operation: UPDATE
      New Value: new@example.com
    `

    createChangeNoteItem.mockReturnValue({
      date: '2023-05-15',
      userId: 'john_doe',
      userNote: 'This is a user note',
      entity: 'User',
      operation: 'UPDATE',
      newValue: 'new@example.com'
    })

    const result = createChangeNote(rawChangeNote)

    expect(result).toEqual({
      '@date': '2023-05-15',
      '@userId': 'john_doe',
      '@userNote': 'This is a user note',
      changeNoteItems: {
        changeNoteItem: [
          {
            '@systemNote': undefined,
            '@newValue': 'new@example.com',
            '@oldValue': undefined,
            '@entity': 'User',
            '@operation': 'UPDATE',
            '@field': undefined
          }
        ]
      }
    })
  })

  test('should handle missing optional fields', () => {
    const rawChangeNote = `
      Date: 2023-05-15
      User Id: john_doe
      Entity: User
      Operation: UPDATE
    `

    createChangeNoteItem.mockReturnValue({
      date: '2023-05-15',
      userId: 'john_doe',
      entity: 'User',
      operation: 'UPDATE'
    })

    const result = createChangeNote(rawChangeNote)

    expect(result).toEqual({
      '@date': '2023-05-15',
      '@userId': 'john_doe',
      '@userNote': undefined,
      changeNoteItems: {
        changeNoteItem: [
          {
            '@systemNote': undefined,
            '@newValue': undefined,
            '@oldValue': undefined,
            '@entity': 'User',
            '@operation': 'UPDATE',
            '@field': undefined
          }
        ]
      }
    })
  })

  test('should handle an empty change note', () => {
    const rawChangeNote = ''

    createChangeNoteItem.mockReturnValue({})

    const result = createChangeNote(rawChangeNote)

    expect(result).toEqual({
      '@date': undefined,
      '@userId': undefined,
      '@userNote': undefined,
      changeNoteItems: {
        changeNoteItem: [
          {
            '@systemNote': undefined,
            '@newValue': undefined,
            '@oldValue': undefined,
            '@entity': undefined,
            '@operation': undefined,
            '@field': undefined
          }
        ]
      }
    })
  })
})
