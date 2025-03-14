import {
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { buildFullPath } from '../buildFullPath'
import { getNumberOfCmrCollections } from '../getNumberOfCmrCollections'
import {
  createChangeNote,
  getAltLabels,
  getRelated,
  processChangeNotes,
  toKeywordJson
} from '../toKeywordJson'
import toLegacyJSON from '../toLegacyJSON'

vi.mock('../buildFullPath')
vi.mock('../getNumberOfCmrCollections')
vi.mock('../toLegacyJSON')

describe('toKeywordJson', () => {
  test('should convert SKOS concept to keyword JSON', async () => {
    const skosConcept = {
      '@rdf:about': 'http://example.com/concept/1',
      'skos:prefLabel': {
        '@xml:lang': 'en',
        '#text': 'Example Concept'
      },
      'gcmd:altLabel': [
        {
          '@gcmd:category': 'primary',
          '@gcmd:text': 'Example Alt Label',
          '@xml:lang': 'en'
        }
      ],
      'skos:inScheme': { '@rdf:resource': 'http://example.com/scheme/1' },
      'skos:definition': { _text: 'This is an example concept' },
      'gcmd:reference': { '@gcmd:text': 'Example reference' },
      'skos:changeNote': 'Date: 2023-06-01\nUser Id: user123\nChange Note Item\nOperation: Add\nField: prefLabel'
    }

    const conceptSchemeMap = new Map()
    const prefLabelMap = new Map()

    buildFullPath.mockResolvedValue('/Example Concept')
    getNumberOfCmrCollections.mockResolvedValue(0)
    toLegacyJSON.mockReturnValue({
      uuid: 'http://example.com/concept/1',
      prefLabel: 'Example Concept'
    })

    const result = await toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap)

    expect(result).toEqual({
      root: true,
      uuid: 'http://example.com/concept/1',
      prefLabel: 'Example Concept',
      longName: 'Example Alt Label',
      altLabels: [{
        category: 'primary',
        text: 'Example Alt Label',
        languageCode: 'en'
      }],
      scheme: '1',
      fullPath: '/Example Concept',
      numberOfCollections: 0,
      definition: 'This is an example concept',
      reference: 'Example reference',
      changeNotes: [{
        date: '2023-06-01',
        userId: 'user123',
        changeNoteItems: [{
          operation: 'Add',
          field: 'prefLabel'
        }]
      }],
      narrowers: undefined
    })
  })
})

describe('getAltLabels', () => {
  test('should process alt labels correctly', () => {
    const altLabels = [
      {
        '@gcmd:category': 'primary',
        '@gcmd:text': 'Example Alt Label',
        '@xml:lang': 'en'
      },
      {
        '@gcmd:text': 'Another Label',
        '@xml:lang': 'fr'
      }
    ]
    const result = getAltLabels(altLabels)
    expect(result).toEqual([
      {
        category: 'primary',
        text: 'Example Alt Label',
        languageCode: 'en'
      },
      {
        text: 'Another Label',
        languageCode: 'fr'
      }
    ])
  })
})

describe('getRelated', () => {
  test('should process related concepts correctly', () => {
    const skosConcept = {
      'skos:related': [
        { '@rdf:resource': 'http://example.com/concept/2' },
        { '@rdf:resource': 'http://example.com/concept/3' }
      ],
      'gcmd:type': 'RelatedTo'
    }
    const prefLabelMap = new Map([
      ['http://example.com/concept/2', 'Related Concept 2'],
      ['http://example.com/concept/3', 'Related Concept 3']
    ])
    const result = getRelated(skosConcept, prefLabelMap)
    expect(result).toEqual([
      {
        keyword: {
          prefLabel: 'Related Concept 2',
          uuid: 'http://example.com/concept/2'
        },
        relationshipType: 'relatedto'
      },
      {
        keyword: {
          prefLabel: 'Related Concept 3',
          uuid: 'http://example.com/concept/3'
        },
        relationshipType: 'relatedto'
      }
    ])
  })
})

describe('createChangeNote', () => {
  test('should create a change note object from a string', () => {
    const noteString = `
    Date: 2023-06-01
    User Id: user123
    User Note: Updated concept
    Change Note Item
    System Note: Modified prefLabel
    Old Value: Old Label
    New Value: New Label
    Entity: Concept
    Operation: Update
    Field: prefLabel
    `
    const result = createChangeNote(noteString)
    expect(result).toEqual({
      date: '2023-06-01',
      userId: 'user123',
      userNote: 'Updated concept',
      changeNoteItems: [
        {
          systemNote: 'Modified prefLabel',
          oldValue: 'Old Label',
          newValue: 'New Label',
          entity: 'Concept',
          operation: 'Update',
          field: 'prefLabel'
        }
      ]
    })
  })
})

describe('processChangeNotes', () => {
  test('should process multiple change notes', () => {
    const changeNotes = [
      'Date: 2023-06-01\nUser Id: user123\nChange Note Item\nOperation: Add\nField: prefLabel',
      'Date: 2023-06-02\nUser Id: user456\nChange Note Item\nOperation: Update\nField: definition'
    ]
    const result = processChangeNotes(changeNotes)
    expect(result).toEqual([
      {
        date: '2023-06-01',
        userId: 'user123',
        changeNoteItems: [{
          operation: 'Add',
          field: 'prefLabel'
        }]
      },
      {
        date: '2023-06-02',
        userId: 'user456',
        changeNoteItems: [{
          operation: 'Update',
          field: 'definition'
        }]
      }
    ])
  })
})

describe('toKeywordJson error handling', () => {
  test('should throw an error when conversion fails', async () => {
    const skosConcept = {
      '@rdf:about': 'http://example.com/concept/1',
      'skos:inScheme': { '@rdf:resource': 'http://example.com/scheme/1' }
    }
    const conceptSchemeMap = new Map()
    const prefLabelMap = new Map()

    toLegacyJSON.mockReturnValue({
      uuid: 'http://example.com/concept/1',
      prefLabel: 'Example Concept'
    })

    buildFullPath.mockRejectedValue(new Error('Failed to build full path'))

    await expect(toKeywordJson(skosConcept, conceptSchemeMap, prefLabelMap))
      .rejects.toThrow('Failed to convert concept to JSON: Failed to build full path')
  })
})
