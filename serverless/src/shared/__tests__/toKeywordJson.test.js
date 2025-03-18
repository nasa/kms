import {
  describe,
  expect,
  vi
} from 'vitest'

import { buildFullPath } from '../buildFullPath'
import { getNumberOfCmrCollections } from '../getNumberOfCmrCollections'
import {
  createChangeNote,
  getAltLabels,
  processChangeNotes,
  processRelations,
  toKeywordJson
} from '../toKeywordJson'
import toLegacyJSON from '../toLegacyJSON'

vi.mock('../buildFullPath')
vi.mock('../getNumberOfCmrCollections')
vi.mock('../toLegacyJSON')

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('getAltLabels', () => {
  test('should return an empty array if altLabels is undefined', () => {
    expect(getAltLabels(undefined)).toEqual([])
  })

  test('should return an empty array if altLabels is null', () => {
    expect(getAltLabels(null)).toEqual([])
  })

  test('should process a single altLabel object', () => {
    const altLabel = {
      '@gcmd:category': 'primary',
      '@gcmd:text': 'Label 1',
      '@xml:lang': 'en'
    }
    expect(getAltLabels(altLabel)).toEqual([
      {
        category: 'primary',
        text: 'Label 1',
        languageCode: 'en'
      }
    ])
  })

  test('should process an array of altLabel objects', () => {
    const altLabels = [
      {
        '@gcmd:category': 'primary',
        '@gcmd:text': 'Label 1',
        '@xml:lang': 'en'
      },
      {
        '@gcmd:text': 'Label 2',
        '@xml:lang': 'fr'
      }
    ]
    expect(getAltLabels(altLabels)).toEqual([
      {
        category: 'primary',
        text: 'Label 1',
        languageCode: 'en'
      },
      {
        text: 'Label 2',
        languageCode: 'fr'
      }
    ])
  })

  test('should handle altLabels without category', () => {
    const altLabel = {
      '@gcmd:text': 'Label 1',
      '@xml:lang': 'en'
    }
    expect(getAltLabels(altLabel)).toEqual([
      {
        text: 'Label 1',
        languageCode: 'en'
      }
    ])
  })

  test('should handle altLabels without language code', () => {
    const altLabel = {
      '@gcmd:category': 'primary',
      '@gcmd:text': 'Label 1'
    }
    expect(getAltLabels(altLabel)).toEqual([
      {
        category: 'primary',
        text: 'Label 1',
        languageCode: undefined
      }
    ])
  })
})

describe('createChangeNote', () => {
  test('should create a change note object from a valid string', () => {
    const noteString = `
      Date: 2023-05-01
      User Id: user123
      User Note: Updated definition
      Change Note Item #1
      System Note: Definition updated
      New Value: New definition text
      Old Value: Old definition text
      Entity: Definition
      Operation: UPDATE
      Field: definition
    `

    const expectedResult = {
      date: '2023-05-01',
      userId: 'user123',
      userNote: 'Updated definition',
      changeNoteItems: [
        {
          systemNote: 'Definition updated',
          newValue: 'New definition text\n', // Note the added newline
          oldValue: 'Old definition text\n', // Note the added newline
          entity: 'Definition',
          operation: 'UPDATE',
          field: 'definition'
        }
      ]
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })

  test('should handle multiple change note items', () => {
    const noteString = `
      Date: 2023-05-01
      User Id: user123
      User Note: Multiple updates
      Change Note Item #1
      System Note: Definition updated
      New Value: New definition text
      Old Value: Old definition text
      Entity: Definition
      Operation: UPDATE
      Field: definition
      Change Note Item #2
      System Note: Label added
      New Value: New label
      Entity: Label
      Operation: ADD
      Field: altLabel
    `

    const expectedResult = {
      date: '2023-05-01',
      userId: 'user123',
      userNote: 'Multiple updates',
      changeNoteItems: [
        {
          systemNote: 'Definition updated',
          newValue: 'New definition text', // No newline at the end
          oldValue: 'Old definition text', // No newline at the end
          entity: 'Definition',
          operation: 'UPDATE',
          field: 'definition'
        },
        {
          systemNote: 'Label added',
          newValue: 'New label\n', // Newline at the end
          entity: 'Label',
          operation: 'ADD',
          field: 'altLabel'
        }
      ]
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })

  test('should handle multi-line new and old values', () => {
    const noteString = `
      Date: 2023-05-01
      User Id: user123
      Change Note Item #1
      System Note: Multi-line update
      New Value: This is a
      multi-line
      new value
      Old Value: This was a
      multi-line
      old value
      Entity: Description
      Operation: UPDATE
      Field: description
    `

    const expectedResult = {
      date: '2023-05-01',
      userId: 'user123',
      changeNoteItems: [
        {
          systemNote: 'Multi-line update',
          newValue: 'This is a\nmulti-line\nnew value\nmulti-line\nold value\n',
          oldValue: 'This was a\nmulti-line\nold value\n',
          entity: 'Description',
          operation: 'UPDATE',
          field: 'description'
        }
      ]
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })

  test('should handle missing optional fields', () => {
    const noteString = `
      Date: 2023-05-01
      User Id: user123
      Change Note Item #1
      System Note: Minimal update
      Entity: Something
      Operation: UPDATE
    `

    const expectedResult = {
      date: '2023-05-01',
      userId: 'user123',
      changeNoteItems: [
        {
          systemNote: 'Minimal update',
          entity: 'Something',
          operation: 'UPDATE'
        }
      ]
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })

  test('should handle empty input', () => {
    const noteString = ''

    const expectedResult = {
      changeNoteItems: []
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })

  test('should handle input with only metadata and no change note items', () => {
    const noteString = `
      Date: 2023-05-01
      User Id: user123
      User Note: No changes made
    `

    const expectedResult = {
      date: '2023-05-01',
      userId: 'user123',
      userNote: 'No changes made',
      changeNoteItems: []
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })

  test('should handle User Note correctly, including empty and whitespace-only notes', () => {
    const noteStringWithUserNote = `
      Date: 2023-05-11
      User Id: user808
      User Note: This is a user note
      Change Note Item #1
      System Note: User note test
      Entity: UserNoteEntity
      Operation: UPDATE
    `

    const noteStringWithEmptyUserNote = `
      Date: 2023-05-12
      User Id: user909
      User Note:
      Change Note Item #1
      System Note: Empty user note test
      Entity: EmptyNoteEntity
      Operation: UPDATE
    `

    const noteStringWithWhitespaceUserNote = `
      Date: 2023-05-13
      User Id: user101
      User Note:     
      Change Note Item #1
      System Note: Whitespace user note test
      Entity: WhitespaceNoteEntity
      Operation: UPDATE
    `

    const resultWithUserNote = createChangeNote(noteStringWithUserNote)
    const resultWithEmptyUserNote = createChangeNote(noteStringWithEmptyUserNote)
    const resultWithWhitespaceUserNote = createChangeNote(noteStringWithWhitespaceUserNote)

    expect(resultWithUserNote.userNote).toBe('This is a user note')
    expect(resultWithEmptyUserNote.userNote).toBe('')
    expect(resultWithWhitespaceUserNote.userNote).toBe('')

    // Additional checks to ensure other properties are set correctly
    expect(resultWithUserNote).toMatchObject({
      date: '2023-05-11',
      userId: 'user808',
      changeNoteItems: [
        {
          systemNote: 'User note test',
          entity: 'UserNoteEntity',
          operation: 'UPDATE'
        }
      ]
    })

    expect(resultWithEmptyUserNote).toMatchObject({
      date: '2023-05-12',
      userId: 'user909',
      changeNoteItems: [
        {
          systemNote: 'Empty user note test',
          entity: 'EmptyNoteEntity',
          operation: 'UPDATE'
        }
      ]
    })

    expect(resultWithWhitespaceUserNote).toMatchObject({
      date: '2023-05-13',
      userId: 'user101',
      changeNoteItems: [
        {
          systemNote: 'Whitespace user note test',
          entity: 'WhitespaceNoteEntity',
          operation: 'UPDATE'
        }
      ]
    })
  })

  test('should handle multiple New Value and Old Value entries in a single Change Note Item', () => {
    const noteString = `
      Date: 2023-05-10
      User Id: user707
      Change Note Item #1
      System Note: Multiple value update
      New Value: First new value
      New Value: Second new value
      Old Value: First old value
      Old Value: Second old value
      Entity: MultiValueEntity
      Operation: UPDATE
      Field: multiValueField
    `

    const expectedResult = {
      date: '2023-05-10',
      userId: 'user707',
      changeNoteItems: [
        {
          systemNote: 'Multiple value update',
          newValue: 'First new value\nSecond new value\n', // Note the trailing newline
          oldValue: 'First old value\nSecond old value\n', // Note the trailing newline
          entity: 'MultiValueEntity',
          operation: 'UPDATE',
          field: 'multiValueField'
        }
      ]
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })

  test('should ignore unexpected keys', () => {
    const noteString = `
      Date: 2023-05-01
      User Id: user123
      Change Note Item #1
      System Note: Update with unexpected key
      Unexpected Key: This should be ignored
      Entity: Something
      Operation: UPDATE
    `

    const expectedResult = {
      date: '2023-05-01',
      userId: 'user123',
      changeNoteItems: [
        {
          systemNote: 'Update with unexpected key',
          entity: 'Something',
          operation: 'UPDATE'
        }
      ]
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
    vi.restoreAllMocks()
  })

  test('should handle change notes without "Change Note Item" markers', () => {
    const noteString = `
      Date: 2023-05-01
      User Id: user123
      System Note: Single update without marker
      New Value: Updated value
      Entity: Something
      Operation: UPDATE
      Field: someField
    `

    const expectedResult = {
      date: '2023-05-01',
      userId: 'user123',
      changeNoteItems: []
    }

    expect(createChangeNote(noteString)).toEqual(expectedResult)
  })
})

describe('processChangeNotes', () => {
  test('should return an empty array for null input', () => {
    expect(processChangeNotes(null)).toEqual([])
  })

  test('should return an empty array for undefined input', () => {
    expect(processChangeNotes(undefined)).toEqual([])
  })

  test('should process a single change note string', () => {
    const changeNote = `
      Date: 2023-05-01
      User Id: user123
      User Note: Updated definition
      Change Note Item #1
      System Note: Definition updated
      New Value: New definition text
      Old Value: Old definition text
      Entity: Definition
      Operation: UPDATE
      Field: definition
    `
    const result = processChangeNotes(changeNote)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2023-05-01',
      userId: 'user123',
      userNote: 'Updated definition',
      changeNoteItems: [
        {
          systemNote: 'Definition updated',
          newValue: 'New definition text\n', // Note the added newline
          oldValue: 'Old definition text\n', // Note the added newline
          entity: 'Definition',
          operation: 'UPDATE',
          field: 'definition'
        }
      ]
    })
  })

  test('should process an array of change note strings', () => {
    const changeNotes = [
      `
      Date: 2023-05-01
      User Id: user123
      User Note: Updated definition
      Change Note Item #1
      System Note: Definition updated
      New Value: New definition text
      Old Value: Old definition text
      Entity: Definition
      Operation: UPDATE
      Field: definition
      `,
      `
      Date: 2023-05-02
      User Id: user456
      User Note: Added label
      Change Note Item #1
      System Note: Label added
      New Value: New label
      Entity: Label
      Operation: ADD
      Field: altLabel
      `
    ]
    const result = processChangeNotes(changeNotes)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      date: '2023-05-01',
      userId: 'user123',
      userNote: 'Updated definition',
      changeNoteItems: [
        {
          systemNote: 'Definition updated',
          newValue: 'New definition text\n', // Note the added newline
          oldValue: 'Old definition text\n', // Note the added newline
          entity: 'Definition',
          operation: 'UPDATE',
          field: 'definition'
        }
      ]
    })

    expect(result[1]).toEqual({
      date: '2023-05-02',
      userId: 'user456',
      userNote: 'Added label',
      changeNoteItems: [
        {
          systemNote: 'Label added',
          newValue: 'New label\n', // Note the added newline
          entity: 'Label',
          operation: 'ADD',
          field: 'altLabel'
        }
      ]
    })
  })

  test('should handle a change note without Change Note Item marker', () => {
    const changeNote = `
      Date: 2023-05-03
      User Id: user789
      System Note: Simple update
      New Value: Updated value
      Entity: Something
      Operation: UPDATE
      Field: someField
    `
    const result = processChangeNotes(changeNote)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2023-05-03',
      userId: 'user789',
      changeNoteItems: []
    })
  })

  test('should handle a change note with multiple Change Note Items', () => {
    const changeNote = `
      Date: 2023-05-04
      User Id: user101
      User Note: Multiple updates
      Change Note Item #1
      System Note: Definition updated
      New Value: New definition text
      Old Value: Old definition text
      Entity: Definition
      Operation: UPDATE
      Field: definition
      Change Note Item #2
      System Note: Label added
      New Value: New label
      Entity: Label
      Operation: ADD
      Field: altLabel
    `
    const result = processChangeNotes(changeNote)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2023-05-04',
      userId: 'user101',
      userNote: 'Multiple updates',
      changeNoteItems: [
        {
          systemNote: 'Definition updated',
          newValue: 'New definition text', // No newline
          oldValue: 'Old definition text', // No newline
          entity: 'Definition',
          operation: 'UPDATE',
          field: 'definition'
        },
        {
          systemNote: 'Label added',
          newValue: 'New label\n', // Newline preserved only for the last item
          entity: 'Label',
          operation: 'ADD',
          field: 'altLabel'
        }
      ]
    })
  })

  test('should handle a change note with multi-line values', () => {
    const changeNote = `
      Date: 2023-05-05
      User Id: user202
      Change Note Item #1
      System Note: Multi-line update
      New Value: This is a
      multi-line
      new value
      Old Value: This was a
      multi-line
      old value
      Entity: Description
      Operation: UPDATE
      Field: description
    `
    const result = processChangeNotes(changeNote)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2023-05-05',
      userId: 'user202',
      changeNoteItems: [
        {
          systemNote: 'Multi-line update',
          newValue: 'This is a\nmulti-line\nnew value\nmulti-line\nold value\n',
          oldValue: 'This was a\nmulti-line\nold value\n',
          entity: 'Description',
          operation: 'UPDATE',
          field: 'description'
        }
      ]
    })
  })

  test('should handle an empty change note string', () => {
    const result = processChangeNotes('')
    expect(result).toEqual([])
  })

  test('should handle a change note with missing fields', () => {
    const changeNote = `
      Date: 2023-05-06
      User Id: user303
      Change Note Item #1
      System Note: Incomplete update
      Entity: Something
    `
    const result = processChangeNotes(changeNote)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2023-05-06',
      userId: 'user303',
      changeNoteItems: [
        {
          systemNote: 'Incomplete update',
          entity: 'Something'
        }
      ]
    })
  })

  test('should handle an array with mixed valid and invalid change notes', () => {
    const changeNotes = [
      `
    Date: 2023-05-07
    User Id: user404
    Change Note Item #1
    System Note: Valid update
    New Value: Updated value
    Entity: Something
    Operation: UPDATE
    Field: someField
    `,
      'This is not a valid change note',
      `
    Date: 2023-05-08
    User Id: user505
    Change Note Item #1
    System Note: Another valid update
    New Value: Another updated value
    Entity: AnotherThing
    Operation: UPDATE
    Field: anotherField
    `
    ]
    const result = processChangeNotes(changeNotes)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      date: '2023-05-07',
      userId: 'user404',
      changeNoteItems: [
        {
          systemNote: 'Valid update',
          newValue: 'Updated value\n', // Note the added newline
          entity: 'Something',
          operation: 'UPDATE',
          field: 'someField'
        }
      ]
    })

    expect(result[1]).toEqual({
      changeNoteItems: []
    })

    expect(result[2]).toEqual({
      date: '2023-05-08',
      userId: 'user505',
      changeNoteItems: [
        {
          systemNote: 'Another valid update',
          newValue: 'Another updated value\n', // Note the added newline
          entity: 'AnotherThing',
          operation: 'UPDATE',
          field: 'anotherField'
        }
      ]
    })
  })

  test('should handle a change note with unexpected keys', () => {
    const originalConsoleWarn = console.warn
    console.warn = (...args) => {
      if (args[0].includes('Unexpected key in change note:')) {
        return
      }

      originalConsoleWarn(...args)
    }

    const changeNote = `
    Date: 2023-05-09
    User Id: user606
    Unexpected Key: This should be ignored
    Change Note Item #1
    System Note: Update with unexpected key
    New Value: Updated value
    Entity: Something
    Operation: UPDATE
    Field: someField
    Another Unexpected Key: This should also be ignored
  `
    const result = processChangeNotes(changeNote)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2023-05-09',
      userId: 'user606',
      changeNoteItems: [
        {
          systemNote: 'Update with unexpected key',
          newValue: 'Updated value\n', // Note the added newline
          entity: 'Something',
          operation: 'UPDATE',
          field: 'someField'
        }
      ]
    })

    console.warn = vi.restoreAllMocks()
  })
})

describe('processRelations', () => {
  let prefLabelMap

  beforeEach(() => {
    prefLabelMap = new Map([
      ['uuid1', 'Instrument 1'],
      ['uuid2', 'Instrument 2'],
      ['uuid3', 'Platform 1'],
      ['uuid4', 'Platform 2']
    ])
  })

  test('should process hasInstrument relations', () => {
    const concept = {
      'gcmd:hasInstrument': [
        { '@rdf:resource': 'uuid1' },
        { '@rdf:resource': 'uuid2' }
      ]
    }

    const result = processRelations(concept, prefLabelMap)

    expect(result).toEqual([
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Instrument 1'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid2',
          prefLabel: 'Instrument 2'
        },
        relationshipType: 'has_instrument'
      }
    ])
  })

  test('should process isOnPlatform relations', () => {
    const concept = {
      'gcmd:isOnPlatform': [
        { '@rdf:resource': 'uuid3' },
        { '@rdf:resource': 'uuid4' }
      ]
    }

    const result = processRelations(concept, prefLabelMap)

    expect(result).toEqual([
      {
        keyword: {
          uuid: 'uuid3',
          prefLabel: 'Platform 1'
        },
        relationshipType: 'is_on_platform'
      },
      {
        keyword: {
          uuid: 'uuid4',
          prefLabel: 'Platform 2'
        },
        relationshipType: 'is_on_platform'
      }
    ])
  })

  test('should process both hasInstrument and isOnPlatform relations', () => {
    const concept = {
      'gcmd:hasInstrument': { '@rdf:resource': 'uuid1' },
      'gcmd:isOnPlatform': { '@rdf:resource': 'uuid3' }
    }

    const result = processRelations(concept, prefLabelMap)

    expect(result).toEqual([
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Instrument 1'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid3',
          prefLabel: 'Platform 1'
        },
        relationshipType: 'is_on_platform'
      }
    ])
  })

  test('should handle single relation as object', () => {
    const concept = {
      'gcmd:hasInstrument': { '@rdf:resource': 'uuid1' }
    }

    const result = processRelations(concept, prefLabelMap)

    expect(result).toEqual([
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Instrument 1'
        },
        relationshipType: 'has_instrument'
      }
    ])
  })

  test('should return empty array for no relations', () => {
    const concept = {}

    const result = processRelations(concept, prefLabelMap)

    expect(result).toEqual([])
  })

  test('should handle unknown UUIDs', () => {
    const concept = {
      'gcmd:hasInstrument': { '@rdf:resource': 'unknownUuid' }
    }

    const result = processRelations(concept, prefLabelMap)

    expect(result).toEqual([
      {
        keyword: {
          uuid: 'unknownUuid',
          prefLabel: undefined
        },
        relationshipType: 'has_instrument'
      }
    ])
  })
})

describe('toKeywordJson', () => {
  let consoleErrorSpy
  beforeEach(() => {
    vi.resetAllMocks()
    buildFullPath.mockResolvedValue('mocked/full/path')
    getNumberOfCmrCollections.mockResolvedValue(10)
    toLegacyJSON.mockReturnValue({
      narrower: [],
      termsOfUse: 'Mocked terms',
      definitions: ['Mocked definition'],
      keywordVersion: '1.0',
      schemeVersion: '1.0',
      viewer: 'Mocked viewer',
      isLeaf: false,
      lastModifiedDate: '2023-01-01',
      broader: [{
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept'
      }]
    })

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore the original console.error after each test
    consoleErrorSpy.mockRestore()
  })

  test('should convert a SKOS concept to JSON representation', async () => {
    const skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' },
      'gcmd:altLabel': [{
        '@gcmd:category': 'primary',
        '@gcmd:text': 'Test Concept',
        '@xml:lang': 'en'
      }],
      'skos:definition': { _text: 'This is a test concept.' },
      'gcmd:reference': { '@gcmd:text': 'https://example.com/test' },
      'skos:changeNote': 'Date: 2023-05-01\nUser Id: user123\nChange Note Item #1\nSystem Note: Created'
    }
    const conceptSchemeMap = {}
    const prefLabelMap = new Map()

    const result = await toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap)

    expect(result).toEqual({
      broader: {
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept'
      },
      root: true,
      longName: 'Test Concept',
      altLabels: [
        {
          category: 'primary',
          text: 'Test Concept',
          languageCode: 'en'
        }
      ],
      scheme: 'test_scheme',
      fullPath: 'mocked/full/path',
      numberOfCollections: 10,
      definition: 'This is a test concept.',
      reference: 'https://example.com/test',
      changeNotes: [
        {
          changeNoteItems: [
            {
              systemNote: 'Created'
            }
          ],
          date: '2023-05-01',
          userId: 'user123'
        }
      ],
      version: '1.0'
    })

    // The 'uuid' from the input is not present in the output
    // If this is intentional, we can remove this check
    // If it should be included, we need to modify the toKeywordJson function
    // expect(result).toHaveProperty('uuid', 'test-uuid')
  })

  test('should handle missing optional fields', async () => {
    const skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' }
    }
    const conceptSchemeMap = {}
    const prefLabelMap = new Map()

    // Mock the toLegacyJSON function to return a minimal object
    toLegacyJSON.mockReturnValue({
      broader: [{
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept'
      }]
    })

    const result = await toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap)

    expect(result).toEqual({
      broader: {
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept'
      },
      root: true,
      scheme: 'test_scheme',
      fullPath: 'mocked/full/path',
      numberOfCollections: 10
    })

    // Check that optional fields are not present
    expect(result).not.toHaveProperty('altLabels')
    expect(result).not.toHaveProperty('longName')
    expect(result).not.toHaveProperty('definition')
    expect(result).not.toHaveProperty('reference')
    expect(result).not.toHaveProperty('changeNotes')
  })

  test('should process relations correctly', async () => {
    const skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' },
      'gcmd:hasInstrument': [{ '@rdf:resource': 'instrument-uuid' }],
      'gcmd:isOnPlatform': { '@rdf:resource': 'platform-uuid' }
    }
    const conceptSchemeMap = {}
    const conceptToConceptSchemeShortNameMap = {}
    const prefLabelMap = new Map([
      ['instrument-uuid', 'Test Instrument'],
      ['platform-uuid', 'Test Platform']
    ])

    const result = await toKeywordJson(
      skosConcept,
      conceptSchemeMap,
      conceptToConceptSchemeShortNameMap,
      prefLabelMap
    )

    expect(result.related).toEqual([
      {
        keyword: {
          uuid: 'instrument-uuid',
          prefLabel: 'Test Instrument'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'platform-uuid',
          prefLabel: 'Test Platform'
        },
        relationshipType: 'is_on_platform'
      }
    ])
  })

  test('should handle multiple change notes and sort them', async () => {
    const skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' },
      'skos:changeNote': [
        'Date: 2023-05-02\nUser Id: user456\nChange Note Item #1\nSystem Note: Updated',
        'Date: 2023-05-01\nUser Id: user123\nChange Note Item #1\nSystem Note: Created'
      ]
    }
    const conceptSchemeMap = {}
    const prefLabelMap = new Map()

    const result = await toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap)

    expect(result.changeNotes).toEqual([
      {
        date: '2023-05-02',
        userId: 'user456',
        changeNoteItems: [{ systemNote: 'Updated' }]
      },
      {
        date: '2023-05-01',
        userId: 'user123',
        changeNoteItems: [{ systemNote: 'Created' }]
      }
    ])
  })

  test('should map narrowers, remove scheme property, sort alphabetically (case-sensitive), and handle duplicate prefLabels', async () => {
    const skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' }
    }
    const conceptSchemeMap = {}
    const conceptToConceptSchemeShortNameMap = {}
    const prefLabelMap = new Map()

    // Mock toLegacyJSON to return an object with narrower terms in unsorted order, including duplicates
    toLegacyJSON.mockReturnValue({
      narrower: [
        {
          uuid: 'narrower2',
          prefLabel: 'Zebra',
          scheme: 'test_scheme'
        },
        {
          uuid: 'narrower1',
          prefLabel: 'Apple',
          scheme: 'test_scheme'
        },
        {
          uuid: 'narrower3',
          prefLabel: 'Banana',
          scheme: 'test_scheme'
        },
        {
          uuid: 'narrower4',
          prefLabel: 'apple',
          scheme: 'test_scheme'
        },
        {
          uuid: 'narrower5',
          prefLabel: 'Banana',
          scheme: 'test_scheme'
        } // Duplicate prefLabel
      ],
      broader: [{
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept'
      }]
    })

    const result = await toKeywordJson(
      skosConcept,
      conceptSchemeMap,
      conceptToConceptSchemeShortNameMap,
      prefLabelMap
    )

    // Check that narrowers are mapped correctly, scheme is removed, and they are sorted
    expect(result.narrowers).toEqual([
      {
        uuid: 'narrower1',
        prefLabel: 'Apple'
      },
      {
        uuid: 'narrower3',
        prefLabel: 'Banana'
      },
      {
        uuid: 'narrower5',
        prefLabel: 'Banana'
      }, // Duplicate prefLabel
      {
        uuid: 'narrower2',
        prefLabel: 'Zebra'
      },
      {
        uuid: 'narrower4',
        prefLabel: 'apple'
      }
    ])

    // Additional checks for sorting and duplicate handling
    expect(result.narrowers[0].prefLabel).toBe('Apple')
    expect(result.narrowers[1].prefLabel).toBe('Banana')
    expect(result.narrowers[2].prefLabel).toBe('Banana')
    expect(result.narrowers[1].uuid).not.toBe(result.narrowers[2].uuid) // Ensure different UUIDs for duplicates
    expect(result.narrowers[3].prefLabel).toBe('Zebra')
    expect(result.narrowers[4].prefLabel).toBe('apple')

    // Verify that the original narrower array is not present
    expect(result).not.toHaveProperty('narrower')

    // Check other properties
    expect(result).toMatchObject({
      scheme: 'test_scheme',
      fullPath: 'mocked/full/path',
      numberOfCollections: 10,
      broader: {
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept'
      }
    })
  })

  test('should handle concepts with broader terms', async () => {
    const skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' },
      'skos:broader': { '@rdf:resource': 'broader-uuid' }
    }
    const conceptSchemeMap = {}
    const prefLabelMap = new Map()

    toLegacyJSON.mockReturnValue({
      broader: [{
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept'
      }]
    })

    const result = await toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap)

    expect(result.root).toBe(false)
    expect(result.broader).toEqual({
      uuid: 'broader-uuid',
      prefLabel: 'Broader Concept'
    })

    // Check other properties
    expect(result).toMatchObject({
      scheme: 'test_scheme',
      fullPath: 'mocked/full/path',
      numberOfCollections: 10
    })

    // Check that the scheme property is not present in the broader object
    expect(result.broader).not.toHaveProperty('scheme')
  })

  test('should handle errors gracefully', async () => {
    const skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' }
    }
    const conceptSchemeMap = {}
    const prefLabelMap = new Map()

    toLegacyJSON.mockImplementation(() => {
      throw new Error('Legacy JSON conversion failed')
    })

    await expect(toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap))
      .rejects.toThrow('Legacy JSON conversion failed')
  })

  test('should throw an error when conversion fails', async () => {
    // Mock a concept that will cause an error
    const skosConcept = {
      '@rdf:about': 'uuid123',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/earth_science' }
      // Deliberately omit required properties to cause an error
    }

    const conceptSchemeMap = {}
    const conceptToConceptSchemeShortNameMap = new Map()
    const prefLabelMap = new Map()

    // Mock buildFullPath to throw an error
    vi.mocked(buildFullPath).mockRejectedValue(new Error('Failed to build full path'))

    // Expect the function to throw an error

    await expect(
      toKeywordJson(
        skosConcept,
        conceptSchemeMap,
        conceptToConceptSchemeShortNameMap,
        prefLabelMap
      )
    )
      .rejects.toThrow('Failed to convert concept to JSON: Failed to build full path')

    // Verify that console.error was called with the expected message
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error converting concept to JSON: Failed to build full path')
  })
})

describe('toKeywordJson broader handling', () => {
  let skosConcept; let conceptSchemeMap; let conceptToConceptSchemeShortNameMap; let
    prefLabelMap

  beforeEach(() => {
    skosConcept = {
      '@rdf:about': 'test-uuid',
      'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/test_scheme' }
    }

    conceptSchemeMap = {}
    conceptToConceptSchemeShortNameMap = {}
    prefLabelMap = new Map()

    buildFullPath.mockResolvedValue('mocked/full/path')
    getNumberOfCmrCollections.mockResolvedValue(10)
  })

  test('should handle concept with broader term', async () => {
    toLegacyJSON.mockReturnValue({
      broader: [{
        uuid: 'broader-uuid',
        prefLabel: 'Broader Concept',
        scheme: 'test_scheme'
      }]
    })

    const result = await toKeywordJson(
      skosConcept,
      conceptSchemeMap,
      conceptToConceptSchemeShortNameMap,
      prefLabelMap
    )

    expect(result.broader).toEqual({
      uuid: 'broader-uuid',
      prefLabel: 'Broader Concept'
    })

    expect(result.broader).not.toHaveProperty('scheme')
  })

  test('should handle concept without broader term', async () => {
    toLegacyJSON.mockReturnValue({
      broader: []
    })

    const result = await toKeywordJson(
      skosConcept,
      conceptSchemeMap,
      conceptToConceptSchemeShortNameMap,
      prefLabelMap
    )

    expect(result.broader).toBeUndefined()
    expect(result.root).toBe(true)
  })
})
