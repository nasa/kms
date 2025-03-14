import {
  describe,
  expect,
  test
} from 'vitest'

import { createChangeNote } from '../createChangeNote'

describe('createChangeNote', () => {
  describe('when processing a single change note item', () => {
    test('should correctly parse all fields', () => {
      const note = `
        Change Note Information
        Date: 2020-01-06
        User Id: tstevens
        User Note: Rename Concept
        Change Note Item #1
        System Note: update PrefLabel
        New Value: EARLY
        Old Value: LOWER
        Entity: PrefLabel
        Operation: UPDATE
        Field: text
      `

      const result = createChangeNote(note)

      expect(result).toEqual({
        '@date': '2020-01-06',
        '@userId': 'tstevens',
        '@userNote': 'Rename Concept',
        changeNoteItems: {
          changeNoteItem: [
            {
              '@systemNote': 'update PrefLabel',
              '@newValue': 'EARLY',
              '@oldValue': 'LOWER',
              '@entity': 'PrefLabel',
              '@operation': 'UPDATE',
              '@field': 'text'
            }
          ]
        }
      })
    })
  })

  describe('when processing multiple change note items', () => {
    test('should correctly parse all items', () => {
      const note = `
        Change Note Information
        Date: 2020-01-06
        User Id: tstevens
        User Note: Multiple Changes
        Change Note Item #1
        System Note: update PrefLabel
        New Value: EARLY
        Old Value: LOWER
        Entity: PrefLabel
        Operation: UPDATE
        Field: text
        Change Note Item #2
        System Note: add relation
        New Value: NewRelation
        Entity: Relation
        Operation: INSERT
      `

      const result = createChangeNote(note)

      expect(result.changeNoteItems.changeNoteItem).toHaveLength(2)
      expect(result.changeNoteItems.changeNoteItem[1]).toEqual({
        '@systemNote': 'add relation',
        '@newValue': 'NewRelation',
        '@entity': 'Relation',
        '@operation': 'INSERT'
      })
    })
  })

  describe('when processing a note with missing fields', () => {
    test('should handle missing fields gracefully', () => {
      const note = `
        Change Note Information
        Date: 2020-01-06
        User Id: tstevens
        User Note:
        Change Note Item #1
        System Note: update PrefLabel
        New Value: EARLY
      `

      const result = createChangeNote(note)

      expect(result).toEqual({
        '@date': '2020-01-06',
        '@userId': 'tstevens',
        '@userNote': '',
        changeNoteItems: {
          changeNoteItem: [
            {
              '@systemNote': 'update PrefLabel',
              '@newValue': 'EARLY'
            }
          ]
        }
      })
    })
  })

  describe('when processing a note with values containing colons', () => {
    test('should correctly parse values with colons', () => {
      const note = `
        Change Note Information
        Date: 2020-01-06
        User Id: tstevens
        User Note: Complex Change
        Change Note Item #1
        System Note: update complex value
        New Value: This: is: a: complex: value
        Entity: ComplexField
        Operation: UPDATE
      `

      const result = createChangeNote(note)

      expect(result.changeNoteItems.changeNoteItem[0]['@newValue']).toBe('This: is: a: complex: value')
    })
  })
})
