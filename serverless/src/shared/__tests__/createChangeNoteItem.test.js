import {
  describe,
  expect,
  test
} from 'vitest'

import { createChangeNoteItem } from '../createChangeNoteItem'

describe('createChangeNoteItem', () => {
  test('handles basic case with all fields', () => {
    const rawText = `Date: 2023-05-15
User Id: john_doe
Entity: User
Operation: UPDATE
System Note: Some system note
Field: email
User Note: User requested change
Old Value: old@email.com
New Value: new@email.com`

    const result = createChangeNoteItem(rawText)

    expect(result).toEqual({
      date: '2023-05-15',
      userId: 'john_doe',
      entity: 'User',
      operation: 'UPDATE',
      systemNote: 'Some system note',
      field: 'email',
      userNote: 'User requested change',
      oldValue: 'old@email.com',
      newValue: 'new@email.com'
    })
  })

  test('handles missing fields gracefully', () => {
    const rawText = `Date: 2023-05-15
Entity: User
New Value: john.doe@example.com`

    const result = createChangeNoteItem(rawText)

    expect(result).toEqual({
      date: '2023-05-15',
      entity: 'User',
      newValue: 'john.doe@example.com'
    })
  })

  test('correctly processes multi-line field values preserving new lines', () => {
    const rawText = `Date: 2023-05-15
User Id: john_doe
New Value: This is a
multi-line value
with preserved
new lines
Entity: User
Operation: INSERT`

    const result = createChangeNoteItem(rawText)

    expect(result.newValue).toBe('This is a\nmulti-line value\nwith preserved\nnew lines')
    expect(result.entity).toBe('User')
    expect(result.operation).toBe('INSERT')
  })

  test('handles fields being on the same line', () => {
    const rawText = `Date: 2023-05-15 User Id: john_doe
Entity: User Operation: UPDATE
New Value: example@email.com`

    const result = createChangeNoteItem(rawText)

    expect(result).toEqual({
      date: '2023-05-15',
      userId: 'john_doe',
      entity: 'User',
      operation: 'UPDATE',
      newValue: 'example@email.com'
    })
  })

  test('handles complex multi-line values with embedded colons', () => {
    const rawText = `Date: 2023-05-15
User Id: john_doe
New Value: This is a complex value:
It has multiple lines
And even has: colons
Within its content
Entity: User
Operation: COMPLEX_UPDATE`

    const result = createChangeNoteItem(rawText)

    expect(result.newValue).toBe('This is a complex value:\nIt has multiple lines\nAnd even has: colons\nWithin its content')
    expect(result.entity).toBe('User')
    expect(result.operation).toBe('COMPLEX_UPDATE')
  })

  test('handles input with no recognized fields', () => {
    const rawText = `This is some text
that doesn't contain any
recognized fields.`

    const result = createChangeNoteItem(rawText)

    expect(result).toEqual({
      other: `This is some text
that doesn't contain any
recognized fields.`
    })
  })
})
