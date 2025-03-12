import {
  describe,
  expect,
  test
} from 'vitest'

import createChangeNote from '../createChangeNote'

describe('createChangeNote', () => {
  describe('when processing a change note for renaming a concept', () => {
    const note = `ChangeNote Information
date: 2020-01-06
userId: tstevens
userNote: Rename Concept
ChangeNoteItem #1
systemNote: update PrefLabel
newValue: EARLY
oldValue: LOWER
entity: PrefLabel
operation: UPDATE
field: text`

    test('should correctly parse all fields', () => {
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

  describe('when processing a change note for inserting a concept with broader relation', () => {
    const note = `ChangeNote Information
date: 2019-12-17
userId: tstevens
userNote:
ChangeNoteItem #1
systemNote: add broader relation
newValue: LOWER [00c6f0f3-5734-4500-a69e-f6780e365985,532259] - ORDOVICIAN [02f8be65-6bdd-4f4d-9e69-adac5aec33f6,505095]
entity: BroaderRelation
operation: INSERT`

    test('should correctly parse all fields including complex newValue', () => {
      const result = createChangeNote(note)

      expect(result).toEqual({
        '@date': '2019-12-17',
        '@userId': 'tstevens',
        '@userNote': '',
        changeNoteItems: {
          changeNoteItem: [
            {
              '@systemNote': 'add broader relation',
              '@newValue': 'LOWER [00c6f0f3-5734-4500-a69e-f6780e365985,532259] - ORDOVICIAN [02f8be65-6bdd-4f4d-9e69-adac5aec33f6,505095]',
              '@entity': 'BroaderRelation',
              '@operation': 'INSERT'
            }
          ]
        }
      })
    })
  })

  describe('when processing a change note for inserting a concept with narrower relation', () => {
    const note = `ChangeNote Information
date: 2019-12-17
userId: tstevens
userNote: Insert Concept
ChangeNoteItem #1
systemNote: add narrower relation
newValue: LOWER [00c6f0f3-5734-4500-a69e-f6780e365985,532259] - TREMADOCIAN [cb8eee5d-fd20-4465-a917-051562f5fcd1,532287]
entity: NarrowerRelation
operation: INSERT`

    test('should correctly parse all fields for narrower relation', () => {
      const result = createChangeNote(note)

      expect(result).toEqual({
        '@date': '2019-12-17',
        '@userId': 'tstevens',
        '@userNote': 'Insert Concept',
        changeNoteItems: {
          changeNoteItem: [
            {
              '@systemNote': 'add narrower relation',
              '@newValue': 'LOWER [00c6f0f3-5734-4500-a69e-f6780e365985,532259] - TREMADOCIAN [cb8eee5d-fd20-4465-a917-051562f5fcd1,532287]',
              '@entity': 'NarrowerRelation',
              '@operation': 'INSERT'
            }
          ]
        }
      })
    })
  })

  describe('when processing a change note with multiple ChangeNoteItems', () => {
    const note = `ChangeNote Information
date: 2020-01-06
userId: tstevens
userNote: Multiple Changes
ChangeNoteItem #1
systemNote: update PrefLabel
newValue: EARLY
oldValue: LOWER
entity: PrefLabel
operation: UPDATE
field: text
ChangeNoteItem #1
systemNote: add relation
newValue: NewRelation
entity: Relation
operation: INSERT`

    test('should correctly parse all ChangeNoteItems', () => {
      const result = createChangeNote(note)

      expect(result.changeNoteItems.changeNoteItem).toHaveLength(2)
      expect(result).toEqual({
        '@date': '2020-01-06',
        '@userId': 'tstevens',
        '@userNote': 'Multiple Changes',
        changeNoteItems: {
          changeNoteItem: [
            {
              '@systemNote': 'update PrefLabel',
              '@newValue': 'EARLY',
              '@oldValue': 'LOWER',
              '@entity': 'PrefLabel',
              '@operation': 'UPDATE',
              '@field': 'text'
            },
            {
              '@systemNote': 'add relation',
              '@newValue': 'NewRelation',
              '@entity': 'Relation',
              '@operation': 'INSERT'
            }
          ]
        }
      })
    })
  })

  describe('when processing a change note with missing fields', () => {
    const note = `ChangeNote Information
date: 2020-01-06
userId: tstevens
ChangeNoteItem #1
systemNote: update PrefLabel
newValue: EARLY`

    test('should handle missing fields gracefully', () => {
      const result = createChangeNote(note)

      expect(result).toEqual({
        '@date': '2020-01-06',
        '@userId': 'tstevens',
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
})
